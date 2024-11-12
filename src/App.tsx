import { onMount } from 'solid-js';
import './App.css';
import Human from '@vladmandic/human';

const humanConfig = { // user configuration for human, used to fine-tune behavior
  cacheSensitivity: 0.01,
  modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
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

const App = () => {
  const human = new Human(humanConfig)
  let videoRef: HTMLVideoElement

  onMount(()=>{
    (async ()=> {
      await human.load();
      await human.warmup()
      human.webcam.start({element: videoRef, crop: true})
      human.video(videoRef)
    })().catch((e) => {
      throw e;
    });
  })

  return (
    <div class="content">
      <video ref={videoRef!} playsinline/>
    </div>
  );
};

export default App;
