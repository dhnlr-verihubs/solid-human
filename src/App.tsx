import { onMount } from "solid-js";
import "./App.css";
import Human from "@vladmandic/human";

const humanConfig = {
  // user configuration for human, used to fine-tune behavior
  cacheSensitivity: 0.01,
  modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human/models",
  filter: { enabled: true, equalization: true }, // lets run with histogram equilizer
  debug: true,
  face: {
    enabled: true,
    detector: { rotation: true, return: true, mask: false }, // return tensor is used to get detected face image
    description: { enabled: false }, // default model for face descriptor extraction is faceres
    // mobilefacenet: { enabled: true, modelPath: 'https://vladmandic.github.io/human-models/models/mobilefacenet.json' }, // alternative model
    // insightface: { enabled: true, modelPath: 'https://vladmandic.github.io/insightface/models/insightface-mobilenet-swish.json' }, // alternative model
    iris: { enabled: true }, // needed to determine gaze direction
    emotion: { enabled: false }, // not needed
    antispoof: { enabled: true }, // enable optional antispoof module
    liveness: { enabled: true }, // enable optional liveness module
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: true }, // parses face and iris gestures
};

const ok: Record<string, { status: boolean | undefined; val: number }> = {
  // must meet all rules
  faceCount: { status: false, val: 0 },
  faceConfidence: { status: false, val: 0 },
  antispoofCheck: { status: false, val: 0 },
  livenessCheck: { status: false, val: 0 },
  allInstruction: { status: false, val: 0 },
};

const timestamp = { detect: 0, draw: 0 };
const current: {
  face: any;
  instruction: {
    name: string | null;
    startTime: number | null;
  };
} = { face: null, instruction: { name: null, startTime: null } };
const listInstructions: string[] = ["open_mouth", "blink_left", "blink_right"];

function isMouthOpen(landmarks: any): boolean {
  const mouthOpen = Math.min(
    100,
    (500 * Math.abs(landmarks[13][1] - landmarks[14][1])) /
      Math.abs(landmarks[10][1] - landmarks[152][1])
  );
  return mouthOpen > 20;
}

function isLeftEyeBlink(landmarks: any): boolean {
  const openLeft =
    Math.abs(landmarks[374][1] - landmarks[386][1]) /
    Math.abs(landmarks[443][1] - landmarks[450][1]); // center of eye inner lid y coord div center of wider eye border y coord
  return openLeft < 0.2;
}

function isRightEyeBlink(landmarks: any): boolean {
  const openRight =
    Math.abs(landmarks[145][1] - landmarks[159][1]) /
    Math.abs(landmarks[223][1] - landmarks[230][1]); // center of eye inner lid y coord div center of wider eye border y coord
  return openRight < 0.2;
}

// function euclideanDistance(point1: any, point2: any): number {
//   return Math.sqrt(
//     Math.pow(point1[0] - point2[0], 2) + Math.pow(point1[1] - point2[1], 2)
//   );
// }

const App = () => {
  const human = new Human(humanConfig);
  let videoRef: HTMLVideoElement;

  onMount(() => {
    (async () => {
      await human.load();
      await human.warmup();
      await webCam();
      await detectionLoop();
      current.face = await validationLoops();
    })().catch((e) => {
      throw e;
    });
  });

  async function webCam() {
    const cameraOptions: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: "user",
        // @ts-ignore resizeMode is not yet defined in tslib
        resizeMode: "none",
        width: { ideal: document.body.clientWidth },
      },
    };
    const stream: MediaStream = await navigator.mediaDevices.getUserMedia(
      cameraOptions
    );
    const ready = new Promise((resolve) => {
      videoRef.onloadeddata = () => resolve(true);
    });
    videoRef.srcObject = stream;
    void videoRef.play();
    await ready;
  }

  async function detectionLoop() {
    // main detection loop
    if (!videoRef.paused) {
      if (current.face?.tensor) human.tf.dispose(current.face.tensor);
      await human.detect(videoRef); // actual detection; were not capturing output in a local variable as it can also be reached via human.result
      const now = human.now();
      // console.log(Math.round(10000 / (now - timestamp.detect)) / 10);
      timestamp.detect = now;
      if (!isAllOk()) {
        requestAnimationFrame(detectionLoop); // start new frame immediately
      }
    }
  }

  async function validationLoops() {
    const interpolated = human.next(human.result);
    console.log(human.result);
    current.instruction.name = listInstructions[ok.allInstruction.val];

    switch (current.instruction.name) {
      case "open_mouth":
        if (isMouthOpen(interpolated.face[0].mesh)) {
          if (current.instruction.startTime === null) {
            current.instruction.startTime = Date.now();
          }
          const elapsedTime =
            (Date.now() - current.instruction.startTime) / 1000;
          console.log(elapsedTime);

          if (elapsedTime >= 3) {
            ok.allInstruction.val += 1;
          }
        } else {
          current.instruction.startTime = null;
        }
        break;
      case "blink_left":
        if (isLeftEyeBlink(interpolated.face[0].mesh)) {
          if (current.instruction.startTime === null) {
            current.instruction.startTime = Date.now();
          }
          const elapsedTime =
            (Date.now() - current.instruction.startTime) / 1000;
          console.log(elapsedTime);

          if (elapsedTime >= 3) {
            ok.allInstruction.val += 1;
          }
        } else {
          current.instruction.startTime = null;
        }
        break;
      case "blink_right":
        if (isRightEyeBlink(interpolated.face[0].mesh)) {
          if (current.instruction.startTime === null) {
            current.instruction.startTime = Date.now();
          }
          const elapsedTime =
            (Date.now() - current.instruction.startTime) / 1000;
          console.log(elapsedTime);

          if (elapsedTime >= 3) {
            ok.allInstruction.val += 1;
          }
        } else {
          current.instruction.startTime = null;
        }
        break;
      default:
        break;
    }
    ok.faceCount.val = human.result.face.length;
    ok.faceCount.status = ok.faceCount.val === 1;
    if (ok.faceCount.status) {
      ok.allInstruction.status =
        listInstructions.length === ok.allInstruction.val;
      ok.faceConfidence.val =
        human.result.face[0].faceScore || human.result.face[0].boxScore || 0;
      ok.faceConfidence.status = ok.faceConfidence.val >= 0.6;
      ok.antispoofCheck.val = human.result.face[0].real || 0;
      ok.antispoofCheck.status = ok.antispoofCheck.val >= 0.6;
      ok.livenessCheck.val = human.result.face[0].live || 0;
      ok.livenessCheck.status = ok.livenessCheck.val >= 0.6;
    }
    console.log("instruction", current.instruction.name, listInstructions);

    console.log("di validation loop", ok);

    if (isAllOk()) {
      videoRef.pause();
      return human.result.face[0];
    } else {
      return new Promise((resolve) => {
        setTimeout(async () => {
          await validationLoops(); // run validation loop until conditions are met
          resolve(human.result.face[0]); // recursive promise resolve
        }, 30); // use to slow down refresh from max refresh rate to target of 30 fps
      });
    }
  }

  function isAllOk() {
    return (
      ok.faceCount.status &&
      ok.faceConfidence.status &&
      ok.antispoofCheck.status &&
      ok.livenessCheck.status &&
      ok.allInstruction.status
    );
  }

  return (
    <div class="content">
      <video ref={videoRef!} playsinline />
    </div>
  );
};

export default App;
