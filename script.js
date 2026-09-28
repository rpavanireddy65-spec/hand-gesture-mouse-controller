const video = document.getElementById("inputVideo");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");

const cameraMessage = document.getElementById("cameraMessage");

const gestureText = document.getElementById("gestureText");

const handStatus = document.getElementById("handStatus");
const cursorX = document.getElementById("cursorX");
const cursorY = document.getElementById("cursorY");
const currentGesture = document.getElementById("currentGesture");

const virtualCursor = document.getElementById("virtualCursor");
const mouseArea = document.getElementById("mouseArea");

let camera = null;
let cameraRunning = false;

let previousX = 0;
let previousY = 0;

let clickLocked = false;


/* --------------------------------
   MEDIAPIPE HANDS
-------------------------------- */

const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});


hands.setOptions({

    maxNumHands: 1,

    modelComplexity: 1,

    minDetectionConfidence: 0.6,

    minTrackingConfidence: 0.6

});


hands.onResults(onResults);


/* --------------------------------
   CAMERA
-------------------------------- */

async function startCamera() {

    if (cameraRunning) {
        return;
    }

    try {

        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {

            alert(
                "Camera access is not supported by this browser."
            );

            return;
        }

        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 640,
                    height: 480,
                    facingMode: "user"
                },
                audio: false
            });

        video.srcObject = stream;

        await video.play();

        cameraRunning = true;

        cameraMessage.style.display = "none";

        statusText.textContent = "Camera Active";

        statusDot.style.background = "#20b26b";

        /*
            MediaPipe camera loop
        */

        camera = new Camera(video, {

            onFrame: async () => {

                if (cameraRunning) {

                    await hands.send({
                        image: video
                    });

                }

            },

            width: 640,

            height: 480

        });

        camera.start();

    }

    catch (error) {

        console.error(error);

        alert(
            "Camera permission was denied or the camera is unavailable."
        );

        statusText.textContent = "Camera Error";

        statusDot.style.background = "#ff4d4d";
    }
}


/* --------------------------------
   STOP CAMERA
-------------------------------- */

function stopCamera() {

    cameraRunning = false;

    if (camera) {

        camera.stop();

        camera = null;

    }

    if (video.srcObject) {

        const tracks =
            video.srcObject.getTracks();

        tracks.forEach(track => track.stop());

        video.srcObject = null;
    }

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    cameraMessage.style.display = "flex";

    statusText.textContent = "Camera Off";

    statusDot.style.background = "#ff4d4d";

    handStatus.textContent = "No";

    currentGesture.textContent = "None";

    gestureText.textContent = "Waiting...";

    virtualCursor.style.display = "none";
}


/* --------------------------------
   HAND TRACKING
-------------------------------- */

function onResults(results) {

    if (!cameraRunning) {
        return;
    }

    /*
       Canvas size follows camera
    */

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;


    ctx.save();

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
       Draw hand landmarks
    */

    if (
        results.multiHandLandmarks &&
        results.multiHandLandmarks.length > 0
    ) {

        const landmarks =
            results.multiHandLandmarks[0];

        handStatus.textContent = "Yes";

        handStatus.style.color = "#20b26b";


        /*
           Draw hand
        */

        drawConnectors(
            ctx,
            landmarks,
            HAND_CONNECTIONS,
            {
                color: "#5b4bdb",
                lineWidth: 3
            }
        );

        drawLandmarks(
            ctx,
            landmarks,
            {
                color: "#ff4d6d",
                lineWidth: 1,
                radius: 4
            }
        );


        /*
           Index finger tip

           MediaPipe landmark 8 =
           index finger tip
        */

        const indexFinger =
            landmarks[8];


        /*
           Thumb tip

           MediaPipe landmark 4 =
           thumb tip
        */

        const thumb =
            landmarks[4];


        /*
           Convert camera coordinates
           to virtual mouse area
        */

        moveCursor(
            indexFinger.x,
            indexFinger.y
        );


        /*
           Detect pinch
        */

        const distance =
            calculateDistance(
                indexFinger,
                thumb
            );


        if (distance < 0.07) {

            gestureText.textContent =
                "🤏 Click";

            currentGesture.textContent =
                "Left Click";


            if (!clickLocked) {

                clickVirtualElement();

                clickLocked = true;
            }

        }

        else {

            gestureText.textContent =
                "☝️ Moving";

            currentGesture.textContent =
                "Move";

            clickLocked = false;
        }

    }

    else {

        handStatus.textContent = "No";

        handStatus.style.color = "#e5484d";

        gestureText.textContent =
            "No Hand";

        currentGesture.textContent =
            "None";
    }


    ctx.restore();
}


/* --------------------------------
   MOVE VIRTUAL CURSOR
-------------------------------- */

function moveCursor(x, y) {

    const areaWidth =
        mouseArea.clientWidth;

    const areaHeight =
        mouseArea.clientHeight;


    /*
       Camera is mirrored.

       Therefore reverse X.
    */

    let targetX =
        (1 - x) * areaWidth;

    let targetY =
        y * areaHeight;


    /*
       Keep cursor inside area
    */

    targetX =
        Math.max(
            0,
            Math.min(
                areaWidth - 20,
                targetX
            )
        );

    targetY =
        Math.max(
            0,
            Math.min(
                areaHeight - 20,
                targetY
            )
        );


    /*
       Smooth movement
    */

    const smoothFactor = 0.35;

    const smoothX =
        previousX +
        (targetX - previousX) *
        smoothFactor;

    const smoothY =
        previousY +
        (targetY - previousY) *
        smoothFactor;


    previousX = smoothX;
    previousY = smoothY;


    virtualCursor.style.left =
        `${smoothX}px`;

    virtualCursor.style.top =
        `${smoothY}px`;

    virtualCursor.style.display =
        "block";


    cursorX.textContent =
        Math.round(smoothX);

    cursorY.textContent =
        Math.round(smoothY);
}


/* --------------------------------
   PINCH CLICK
-------------------------------- */

function clickVirtualElement() {

    const x = previousX;
    const y = previousY;


    /*
       Temporarily hide cursor so
       elementFromPoint can find
       the element underneath it.
    */

    virtualCursor.style.display =
        "none";


    const element =
        document.elementFromPoint(
            mouseArea.getBoundingClientRect().left + x,
            mouseArea.getBoundingClientRect().top + y
        );


    virtualCursor.style.display =
        "block";


    if (
        element &&
        element.classList.contains(
            "demo-button"
        )
    ) {

        element.click();

    }
}


/* --------------------------------
   DISTANCE BETWEEN TWO LANDMARKS
-------------------------------- */

function calculateDistance(point1, point2) {

    const dx =
        point1.x - point2.x;

    const dy =
        point1.y - point2.y;

    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


/* --------------------------------
   DEMO BUTTON ACTION
-------------------------------- */

document
    .querySelectorAll(".demo-button")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                button.textContent =
                    "✓ Clicked!";

                setTimeout(() => {

                    button.textContent =
                        button.classList.contains("second")
                            ? "Another Button"
                            : "Test Button";

                }, 1000);

            }
        );

    });


/* --------------------------------
   BUTTON EVENTS
-------------------------------- */

startBtn.addEventListener(
    "click",
    startCamera
);

stopBtn.addEventListener(
    "click",
    stopCamera
);


/* --------------------------------
   PAGE EXIT
-------------------------------- */

window.addEventListener(
    "beforeunload",
    stopCamera
);