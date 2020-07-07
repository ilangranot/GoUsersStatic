'use strict';
(function() {
    const DEFAULT_ATO = 5000;
    let goTimeout;
    let isMainOpen = false;
    let gu_server = document.getElementById("gu-tracker").getAttribute("gu-server");
    let d = document.createElement("div" );
    let currentPath;
    d.setAttribute("id", "gu_mainarea");
    document.body.appendChild(d);
    let videoPlayer;
    let stream, recorder;
    let displayMediaOptions = {
        video: {
            cursor: "always"
        },
        audio: true
    };

    // APPEND HTML
    get("/main.html",function (response) {
        document.getElementById("gu_mainarea").innerHTML = response;

        // NEW
        document.getElementById("newButton").addEventListener("click", function(evt) {
            document.getElementById("gu_main").innerHTML = "<h2>Share with others...</h2><br/>" +
                "Subject<br/><input type=\"text\" id=\"subjectInput\"/><br/>Note<br/>" +
                "<textarea id=\"noteInput\" rows=\"2\" cols=\"20\"></textarea><br/>" +
                "<b>Attachment</b><br/><input type=\"file\" id=\"fileInput\"/><br/><br/>" +
                "Or, YouTube url:<br/><input type=\"text\" id=\"youtubeInput\"/><br/>" +
                "<br/><button type=\"button\" class=\"gu-btn\" id=\"sendButton\"/>Send</button>" +
                "<button type=\"button\" class=\"gu-btn\" id=\"recordButton\">Record</button>" +
                "<button type=\"button\" class=\"gu-btn\" id=\"stopButton\">Stop</button>";
            document.getElementById("sendButton").onclick = function() {
                let data = {};
                data.subject = document.getElementById("subjectInput").value;
                data.note = document.getElementById("noteInput").value;
                data.youtubeUrl = document.getElementById("youtubeInput").value;
                data.hostname = window.location.hostname;
                data.pathname = window.location.pathname;
                post("/new", data, function(response){
                    let comm = JSON.parse(response);
                    toggleMain();
                    if (data.youtubeUrl == "")
                        uploadFile(comm.uploadUrl, document.getElementById("fileInput").files[0]);
                });
            };
            //VIDEO
            document.getElementById("recordButton").onclick = async function() {
                try {
                    stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
                    recorder = new MediaRecorder(stream);
                    const chunks = [];
                    recorder.ondataavailable = e => chunks.push(e.data);
                    recorder.onstop = e => {
                        const completeBlob = new Blob(chunks, { type: chunks[0].type });
                        let src = URL.createObjectURL(completeBlob);
                        viewCrumb(src);
                    };
                    recorder.start();
                    toggleMain();
                } catch(err) {
                    console.log("Error: " + err);
                }
            }
            document.getElementById("stopButton").onclick = function () {
                recorder.stop();
                stream.getVideoTracks()[0].stop();
            }
        }, false);

        // GO
        document.getElementById("goButton").addEventListener("click", function(evt) {
            toggleMain();
            window.clearTimeout(goTimeout);
        }, false);
    }); // END APPEND HTML

    // PAGE
    function updatePage() {
        post("/page", window.location, function (response) {
            setGoTimeout(DEFAULT_ATO);
            currentPath = window.location.pathname;
        });
    }

    // CLICK
    window.addEventListener("click", function (e){
        e = e || window.event;
        let target = e.target || e.srcElement,
            text = target.textContent || target.innerText;
        if  (e.target.id.indexOf("goButton") == -1 ) {
            post("/click", {"eventTarget": target, "eventText": text}, function (response) {
                if (currentPath != window.location.pathname)
                    updatePage(); // AJAX update
            });
        }
        setGoTimeout(DEFAULT_ATO);
    });

    // LIST
    function displayListOfCrumbs(){
        post("/list", window.location , function (response) {
            let commJson = JSON.parse(response);
            if (commJson.status == "RESPONSE"){
                let oldList = document.getElementById("gu_main");
                let list = document.createElement("ul");
                list.setAttribute('class', 'gu-list');
                list.id = "gu_main";
                commJson.crumbs.forEach(crumb => {
                    let listElement = document.createElement("li");
                    listElement.setAttribute('class', 'left clearfix');
                    listElement.innerHTML = "<a href='javascript:void(0);'>" +
                        "<span class=\"gu-list-img pull-left\"><div class=\"well well-sm\"><span class=\"glyphicon glyphicon-facetime-video\"></span>"
                        + "</div></span><div class=\"gu-list-body clearfix\"><div class=\"header\"><strong class=\"primary-font\">"
                        + crumb.subject + "</strong> <small class=\"pull-right text-muted\"><span class=\"glyphicon glyphicon-thumbs-up\"></span>recommended</small></div><p>"
                        + crumb.notes + "</p></div></a>";
                    listElement.addEventListener("click", e => viewCrumb(crumb.url), false);
                    list.appendChild(listElement);
                });
                oldList.parentNode.replaceChild(list , oldList);
            }
        }, true);
    }

    // VIEW CRUMB
    function viewCrumb(url) {
        document.getElementById("video_holder").style.display = "block";
        document.getElementById("video_close").addEventListener("click", e => {
            document.getElementById("video_holder").style.display = "none";
            if (videoPlayer !== undefined)
                videoPlayer.pause();
        }, false );
        if (url.indexOf("http") > -1) {
            document.getElementById("video_frame").innerHTML = "<video id='video_player' width=\"640\" height=\"420\" controls>" +
                "<source src=\"" + url + "\" type=\"video/mp4\">" +
                "Your browser does not support the video tag." +
                "</video>";
            videoPlayer = document.getElementById("video_player");
            videoPlayer.play();
        } else {
            document.getElementById("video_frame").innerHTML = "<iframe width=\"560\" height=\"315\" src=\"https://www.youtube-nocookie.com/embed/" +
                url + "?autoplay=1\" frameborder=\"0\" allow=\"accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture\" allowfullscreen></iframe>";
        }
    }

    function get(path, callback) {
        let xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                callback(this.response);
            }
        };
        xhttp.open("GET", "https://static." + gu_server + path, true);
        xhttp.send();
    }

    function post(path, content, callback){
        let comm = {};
        comm.status = "REQUEST";
        comm.content = content;
        let xhttp = new XMLHttpRequest();
        let jsonFromObj = JSON.stringify(comm);
        xhttp.open("POST", "https://app." + gu_server + path, true);
        xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        if (typeof callback !== 'undefined') {
            xhttp.onload = function (e) {
                callback(this.response);
            };
        }
        xhttp.send(jsonFromObj);
    }

    function uploadFile(url, data){
        let xhttp = new XMLHttpRequest();
        xhttp.open("PUT", url, true);
        xhttp.send(data);
    }

    function toggleMain(){
        if (!isMainOpen) {
            displayListOfCrumbs();
            document.getElementById("popup").style.display = "block";
            document.getElementById("goButton-contents").innerHTML = "X";
        } else {
            document.getElementById("popup").style.display = "none";
            document.getElementById("goButton").style.display = "none";
            document.getElementById("goButton-contents").innerHTML = "?";
        }
        isMainOpen = !isMainOpen;
    }

    function setGoTimeout(averageTimeout){
        if (goTimeout != null)
            window.clearTimeout(goTimeout);
        goTimeout = window.setTimeout(function(){
            if (!isMainOpen)
                document.getElementById("goButton").style.display = "block";
        }, averageTimeout);
    }

    updatePage();
})();