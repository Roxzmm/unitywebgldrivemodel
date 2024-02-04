const videoElement =
    document.getElementsByClassName('input_video')[0];
const canvasElement =
    document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');

var thisUnityInstance = null;

if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
}
if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
        var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.oGetUserMedia;
        if (!getUserMedia) {
            return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }
        return new Promise(function (resolve, reject) {
            getUserMedia.call(navigator, constraints, resolve, reject);
        });
    }
}

function connect(ctx, connectors) {
    const canvas = ctx.canvas;
    for (const connector of connectors) {
        const from = connector[0];
        const to = connector[1];
        if (from && to) {
            if (from.visibility && to.visibility &&
                (from.visibility < 0.1 || to.visibility < 0.1)) {
                continue;
            }
            ctx.beginPath();
            ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
            ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
            ctx.stroke();
        }
    }
}

var empty = 0;
const empty_limit = 10 * 5 * 60;

function onResults(results) {
    document.body.classList.add('loaded');

    if (results.poseLandmarks == null) {
        empty++;

        if (empty > empty_limit) {
            leave();
            empty = 0;
            alert("Detected that you have been away from the camera for a long time, automatically disconnecting the channel")
        }
        return
    }

    if (results.poseLandmarks) {
        empty = 0;

        if (thisUnityInstance) {
            var data = {};

            var pose = [];
            if (results.poseLandmarks) {
                for (var i = 0; i < results.poseLandmarks.length; i++) {
                    pose.push({
                        x: results.poseLandmarks[i].x,
                        y: results.poseLandmarks[i].y,
                        z: results.poseLandmarks[i].z,
                        visibility: results.poseLandmarks[i].visibility
                    });
                }
            }
            data.pose = pose;

            var face = [];
            if (results.faceLandmarks) {
                face.push({
                    x: results.faceLandmarks[21].x,
                    y: results.faceLandmarks[21].y,
                    z: results.faceLandmarks[21].z,
                    visibility: results.faceLandmarks[21].visibility
                });

                face.push({
                    x: results.faceLandmarks[251].x,
                    y: results.faceLandmarks[251].y,
                    z: results.faceLandmarks[251].z,
                    visibility: results.faceLandmarks[251].visibility
                });

                face.push({
                    x: results.faceLandmarks[397].x,
                    y: results.faceLandmarks[397].y,
                    z: results.faceLandmarks[397].z,
                    visibility: results.faceLandmarks[397].visibility
                });

                face.push({
                    x: results.faceLandmarks[172].x,
                    y: results.faceLandmarks[172].y,
                    z: results.faceLandmarks[172].z,
                    visibility: results.faceLandmarks[i].visibility
                });
            }


            data.face = face;


            var handL = [];
            if (results.leftHandLandmarks) {
                for (var i = 0; i < results.leftHandLandmarks.length; i++) {
                    handL.push({
                        x: results.leftHandLandmarks[i].x,
                        y: results.leftHandLandmarks[i].y,
                        z: results.leftHandLandmarks[i].z,
                        visibility: results.leftHandLandmarks[i].visibility
                    });
                }
            }
            data.handL = handL;

            var handR = [];
            if (results.rightHandLandmarks) {
                for (var i = 0; i < results.rightHandLandmarks.length; i++) {
                    handR.push({
                        x: results.rightHandLandmarks[i].x,
                        y: results.rightHandLandmarks[i].y,
                        z: results.rightHandLandmarks[i].z,
                        visibility: results.rightHandLandmarks[i].visibility
                    });
                }
            }
            data.handR = handR;

            var jsonStr = JSON.stringify(data);
            thisUnityInstance.SendMessage('Scne2DRunnerForWin', "InputLandmarks", jsonStr);
        }
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(
        results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.restore();
}

const holistic = new Holistic({
    locateFile: (file) => {
        return `./base/${file}`;
    }
});
holistic.setOptions({
    modelComplexity: 2,
    smoothLandmarks: true,
    enableSegmentation: true,
    smoothSegmentation: true,
    refineFaceLandmarks: true,
    upperBodyOnly: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
holistic.onResults(onResults);

var inputIndex = 0;
const camera = new Camera(videoElement, {
    onFrame: async () => {
        inputIndex++;
        if (inputIndex % 2 === 0) {
            await holistic.send({image: videoElement});
        }
    },
    width: 640,
    height: 480
});
camera.start();


//Agora Start===================================================================
// create Agora client
var client = AgoraRTC.createClient({mode: "rtc", codec: "vp8"});

var localTracks = {
    videoTrack: null,
    audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = {
    appid: null,
    channel: null,
    uid: null,
    token: null
};


$("#join-form").submit(async function (e) {
    e.preventDefault();
    $("#join").attr("disabled", true);
    try {
        options.appid = $("#appid").val();
        options.token = $("#token").val();
        options.channel = $("#channel").val();

        console.log("join channel:" + options);
        await join();
        // if(options.token) {
        //     $("#success-alert-with-token").css("display", "block");
        // } else {
        //     $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
        //     $("#success-alert").css("display", "block");
        // }
    } catch (error) {
        console.error(error);
    } finally {
        $("#leave").attr("disabled", false);
    }
})

$("#leave").click(function (e) {
    leave();
})

const canvasUnity = document.getElementById('unity-canvas');
const videoMediaStreamTrack = canvasUnity.captureStream(30);
console.log(videoMediaStreamTrack);

async function join() {

    // add event listener to play remote tracks when remote user publishs.
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);

    // join a channel and create local tracks, we can use Promise.all to run them concurrently
    [options.uid, localTracks.audioTrack, localTracks.videoTrack] = await Promise.all([
        // join the channel
        client.join(options.appid, options.channel, options.token || null),
        // create local tracks, using microphone and canvas
        AgoraRTC.createMicrophoneAudioTrack(),
        AgoraRTC.createCustomVideoTrack({
            bitrateMin: 600,
            bitrateMax: 3300,
            width: 640,
            height: 480,
            frameRate: 30,
            optimizationMode: "motion",
            mediaStreamTrack: videoMediaStreamTrack.getVideoTracks()[0],
        }),
    ]);

    // // play local video track
    // localTracks.videoTrack.play("local-player");
    // $("#local-player-name").text(`localVideo(${options.uid})`);

    // publish local tracks to channel
    await client.publish(Object.values(localTracks));
    console.log("publish success");
}

const loopUpdateInfo = (videoTrack) => {
    const info = videoTrack.getStats()
    const infoDoms = Object.entries(info).map(([k, v]) => {
        if (v.toFixed) v = +v.toFixed(2)
        return `<div>${k}: ${v}</div>`
    })
    const infoRootDom = document.getElementById('info')
    infoRootDom.innerHTML = infoDoms.join('')
    setTimeout(() => {
        loopUpdateInfo(videoTrack)
    }, 1000);
}

async function subscribe(user, mediaType) {
    const uid = user.uid;
    // subscribe to a remote user
    await client.subscribe(user, mediaType);
    console.log("subscribe success");
    if (mediaType === 'video') {
        const player = $(`
      <div id="player-wrapper-${uid}" class="player-wrapper">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
        $("#remote-playerlist").append(player);
        user.videoTrack.play(`player-${uid}`);
        // "f798629b7adc430991bdb1fb0b375daa"
        // window.test = user.videoTrack
        // test.getStats()
        loopUpdateInfo(user.videoTrack)
    }
    if (mediaType === 'audio') {
        user.audioTrack.play();
    }
}

function handleUserPublished(user, mediaType) {
    const id = user.uid;
    remoteUsers[id] = user;
    subscribe(user, mediaType);
}

function handleUserUnpublished(user) {
    const id = user.uid;
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
}

async function leave() {
    for (trackName in localTracks) {
        var track = localTracks[trackName];
        if (track) {
            track.stop();
            track.close();
            localTracks[trackName] = undefined;
        }
    }

    // remove remote users and player views
    remoteUsers = {};
    $("#remote-playerlist").html("");

    // leave the channel
    await client.leave();

    $("#local-player-name").text("");
    $("#join").attr("disabled", false);
    $("#leave").attr("disabled", true);
    console.log("client leaves channel success");
}

//Agora End =================================================================


var container = document.querySelector("#unity-container");
var canvas = document.querySelector("#unity-canvas");
var loadingBar = document.querySelector("#unity-loading-bar");
var progressBarFull = document.querySelector("#unity-progress-bar-full");
var fullscreenButton = document.querySelector("#unity-fullscreen-button");
var warningBanner = document.querySelector("#unity-warning");

// Shows a temporary message banner/ribbon for a few seconds, or
// a permanent error message on top of the canvas if type=='error'.
// If type=='warning', a yellow highlight color is used.
// Modify or remove this function to customize the visually presented
// way that non-critical warnings and error messages are presented to the
// user.
function unityShowBanner(msg, type) {
    function updateBannerVisibility() {
        warningBanner.style.display = warningBanner.children.length ? 'block' : 'none';
    }

    var div = document.createElement('div');
    div.innerHTML = msg;
    warningBanner.appendChild(div);
    if (type == 'error') div.style = 'background: red; padding: 10px;';
    else {
        if (type == 'warning') div.style = 'background: yellow; padding: 10px;';
        setTimeout(function () {
            warningBanner.removeChild(div);
            updateBannerVisibility();
        }, 5000);
    }
    updateBannerVisibility();
}

var buildUrl = "Build";
var loaderUrl = buildUrl + "/Build.loader.js";
var config = {
    dataUrl: "https://media.githubusercontent.com/media/Roxzmm/unitywebgldrivemodel/master/Build/Build.data.unityweb",
    frameworkUrl: buildUrl + "/Build.framework.js.unityweb",
    codeUrl: buildUrl + "/Build.wasm.unityweb",
    streamingAssetsUrl: "StreamingAssets",
    companyName: "DefaultCompany",
    productName: "FancyWebGl",
    productVersion: "0.1",
    showBanner: unityShowBanner,
};

// By default Unity keeps WebGL canvas render target size matched with
// the DOM size of the canvas element (scaled by window.devicePixelRatio)
// Set this to false if you want to decouple this synchronization from
// happening inside the engine, and you would instead like to size up
// the canvas DOM size and WebGL render target sizes yourself.
// config.matchWebGLToCanvasSize = false;

if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    // Mobile device style: fill the whole browser client area with the game canvas:

    var meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, shrink-to-fit=yes';
    document.getElementsByTagName('head')[0].appendChild(meta);
    container.className = "unity-mobile";
    canvas.className = "unity-mobile";

    // To lower canvas resolution on mobile devices to gain some
    // performance, uncomment the following line:
    // config.devicePixelRatio = 1;

    canvas.style.width = "300px";
    canvas.style.height = "480px";
    
    //unityShowBanner('WebGL builds are not supported on mobile devices.');
} else {
    // Desktop style: Render the game canvas in a window that can be maximized to fullscreen:

    canvas.style.width = "960px";
    canvas.style.height = "600px";
}

loadingBar.style.display = "block";

var script = document.createElement("script");

script.src = loaderUrl;
script.onload = () => {
    createUnityInstance(canvas, config, (progress) => {
        progressBarFull.style.width = 100 * progress + "%";
    }).then((unityInstance) => {
        loadingBar.style.display = "none";
        thisUnityInstance = unityInstance;
        fullscreenButton.onclick = () => {
            unityInstance.SetFullscreen(1);
        };
    }).catch((message) => {
        alert(message);
    });
};
document.body.appendChild(script);
