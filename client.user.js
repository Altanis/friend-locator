// ==UserScript==
// @name         FriendLocator
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  A way to see your friends on the minimap! (CouldntHaveDoneItWithoutMyGodShadam)
// @author       Altanis#8593
// @match        https://diep.io/
// @icon         https://www.google.com/s2/favicons?domain=diep.io
// @require      https://raw.githubusercontent.com/supahero1/diep_api/main/api.min.js
// @require      https://raw.githubusercontent.com/Qwokka/wail.min.js/5e32d36bd7a5e0830d1ff4b64d3587aea13f77da/wail.min.js
// @require      https://raw.githubusercontent.com/ABCxFF/diepindepth/main/protocol/userscripts/packethook.user.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11.1.10/dist/sweetalert2.all.min.js
// @grant        none
// @run-at       document-body
// ==/UserScript==

if (!window.Hook) alert('ABC\'s Packet Hook was not initialized properly. As a result, FriendLOcator will not work in Sandbox arenas.');

const api = diep_api();

api.on("ready", async function() {
    // Thank you ABC for letting me use your packet hook.
    // shadam literally did everything for me relating to canvas like he deserves 40% of the credit for this script LOL

    function yeet_ads() {
        const a = document.getElementById('aa_main');
        a?.parentElement?.removeChild(a);
    }
    yeet_ads();
    setInterval(yeet_ads, 150);

    const GUI = document.createElement("div");
    GUI.style = `pointer-events: none; position: fixed; top:97%; left:10px; font-family: Ubuntu; color: #FFFFFF; font-style: normal; font-size: 10px;  text-shadow: black 2px 0px, black -2px 0px, black 0px -2px, black 0px 2px, black 2px 2px, black -2px 2px, black 2px -2px, black -2px -2px, black 1px 2px, black -1px 2px, black 1px -2px, black -1px -2px, black 2px 1px, black -2px 1px, black 2px -1px, black -2px -1px;`;
    document.body.appendChild(GUI);
    GUI.innerHTML = 'Dot Info: Awaiting...';

    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode('.swal2-popup { font-family: Ubuntu }'));
    document.head.appendChild(style);

    HTMLElement.prototype.focus = new Proxy(HTMLElement.prototype.focus, {
        apply: function(el, _this, args) {
            if (guiEnabled && _this == canvas) return true;
            if (!popupsDone && _this == document.getElementById('textInput')) return true;
            else return el.apply(_this, args)
        }
    });
    const htme = HTMLElement.prototype;
    htme.blur = new Proxy(htme.blur, {
        apply: function(f, _this, args) {
            if (document.activeElement === _this) return;
            f.apply(_this, args);
        },
    });

    var popupsDone = true;

    if (!localStorage.getItem('token')) {
        popupsDone = false;
        let { value: name } = await Swal.fire({
            title: 'Enter the name you want to display as in FriendLocator!',
            input: 'text',
            focusConfirm: false,
            inputValidator: function(val) {
                if (!val) return 'Please enter a name.';
                if (val.length >= 16) return 'Username character limit is 16 characters.';
            }
        });

        let { value: color } = await Swal.fire({
            title: 'Enter a 6 Digit Hex Code you want to display as in FriendLocator! (e.g. #FF0000)',
            input: 'text',
            focusConfirm: false,
            inputValidator: function(val) {
                if (!val && !val.startsWith('#') && val.length !== 7) return 'Please enter a valid color.';
            }
        });
        popupsDone = true;

        if (name === undefined || color === undefined) return;

        let rand = `${Math.random().toString(16).substr(2)} + ${name}`;
        let token = btoa(rand); // DO NOT GIVE THIS AWAY. THIS WILL GIVE PEOPLE ACCESS TO YOUR USER. IF YOU NEED TO CLEAR COOKIES/CACHE, GET TOKEN FROM THE MENU. AFTER REFRESHING CACHE, TYPE IN CONSOLE "localStorage.setItem('token', '<your token here DO NOT REMOVE ''>')".

        let UserID = rand.slice(0, 4 - rand.length);
        name = rand.split(' + ')[1];

        localStorage.setItem('UserID', UserID);
        localStorage.setItem('token', token);
        localStorage.setItem('flName', name);
        localStorage.setItem('flColor', color);
    }

    if (localStorage.getItem('token') && (!localStorage.getItem('UserID') || !localStorage.getItem('flName'))) {
        localStorage.setItem('UserID', localStorage.getItem('token').substring(0, 4));
        localStorage.setItem('flName', atob(localStorage.getItem('token')).split(' + ')[1]);
    }

    const socket = new WebSocket('wss://minimap-position.glitch.me');
    socket.onopen = function() {
        console.log('Minimap WebSocket loaded!');
        socket.send(JSON.stringify({
            type: 'IDENTIFY',
            data: {
                token: localStorage.getItem('token'), // all data of your user
                themes: localStorage.getItem('diepStyle'), // detecting UI Scale on server
                color: localStorage.getItem('flColor'),
            }
        }));
    };
    var sending_interval = 100;
    var checker = 0;

    var isSandbox = undefined;

    window.Hook?.addEventListener('clientbound', function({ data }) {
        if (data[0] === 0x04) {
            isSandbox = new TextDecoder().decode(data.slice(1)).split('\x00')[0] === 'sandbox';
        }
        if (data[0] === 0x06) {
            const int = setInterval(function() {
                if (typeof isSandbox === 'undefined') return;
                if (isSandbox)
                    serverID = Array.from(data).map(r => r.toString(16).padStart(2, '0').toUpperCase().split('').reverse().join('')).join('');
                clearInterval(int);
            });
        }
    });


    var serverID = '';
    var firstFetch = true;

    var guiEnabled = false;
    var scriptEnabled = true;

    var friends = [];
    var requests = [];
    var positions = {
        timer: {},
        dead: [],
    };
    var info = {};

    window.WebSocket = new Proxy(window.WebSocket, {
        construct(Target, args) {
            if (args[0] !== serverID && !isSandbox) {
                serverID = args[0];
            }
            return Reflect.construct(Target, args);
        }
    });

    setInterval(function() {
        if (window.serverURL !== serverID && !isSandbox)
            serverID = window.serverURL;
    }, 500);

    var rgba = (hexCode, opacity = 1) => {
        let hex = hexCode.replace('#', '');

        if (hex.length === 3) {
            hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
        }

        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        /* Backward compatibility for whole number based opacity values. */
        if (opacity > 1 && opacity <= 100) {
            opacity = opacity / 100;
        }

        return `rgba(${r},${g},${b},${opacity})`;
    };

    api.on('spawn', function() {
        socket.send(JSON.stringify({ type: 'SEND_COORS', data: { server: serverID, position: ['respawn', 'respawn'] } }));
    });
    api.on('death', function() {
        socket.send(JSON.stringify({ type: 'SEND_COORS', data: { server: serverID, position: ['death', 'death'] } }));
    });

    api.on("draw", function() {
        for (const friend of friends) {
            if (!scriptEnabled || !positions[friend]) continue;
            if (positions[friend][0] === 'ending') continue;
            if (positions[friend][0] === 'death') continue;
            if (info[friend].server !== serverID) continue;

            api.ctx.beginPath();
            api.ctx.fillStyle = info[friend].color || '#000000';
            api.ctx.arc(api.minimap.extended.x + positions[friend][0] * api.minimap.extended.side, api.minimap.extended.y + positions[friend][1] * api.minimap.extended.side, api.ui_scale * 2, 0, Math.PI * 2);
            api.ctx.fill();

            let distance = Math.hypot((api.minimap.extended.x + positions[friend][0] * api.minimap.extended.side) - api.mouse.raw_x, (api.minimap.extended.y + positions[friend][1] * api.minimap.extended.side) - api.mouse.raw_y);
            if (distance <= api.ui_scale * 6) {
                GUI.innerHTML = `Dot Info: ${friend} (${info[friend].name})`;
            } else if (GUI.innerHTML.includes(friend)) {
                GUI.innerHTML = `Dot Info: Awaiting...`;
            }
        }

        if (guiEnabled) {
            api.ctx.beginPath();
            api.ctx.fillStyle = "#000";
            api.ctx.globalAlpha = 0.5;
            api.ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            api.ctx.globalAlpha = 1;
        }
    });

    socket.onmessage = async function({ data }) {
        data = JSON.parse(data);

        switch (data.type) {
            case 'SEND_FRIENDS':
                friends = data.data.friends;
                break;
            case 'UPDATE_FRIENDS':
                friends = data.data.friends;
                break;
            case 'RECEIVE_COORS':
                let { user, name, color } = data;
                let { position, server } = data.data;

                if (typeof info[user] === 'undefined') info[user] = {};
                info[user].server = server;

                if (position[0] === 'ending') {
                    positions[user] = position;
                    positions.timer[user] = 2;
                    setTimeout(function() {
                        delete positions.timer[user];
                    }, 2000);
                } else if (position[0] === 'death') {
                    positions[user] = position;
                    positions.dead.push(user);
                } else if (position[0] === 'respawn') {
                    positions[user] = position;
                    positions.dead.splice(positions.dead.indexOf(user), 1);
                }

                if (serverID !== server) return;

                if (positions.timer[user] || positions.dead.includes(user)) return;
                positions[user] = position;

                info[user] = {
                    name: name,
                    color: color,
                }
                break;
            case 'SEND_REQUESTS':
                let { outgoingRequests, incomingRequests } = data.data;
                requests = outgoingRequests;

                for (let [id, name] of incomingRequests) {
                    const res = await Swal.fire({
                        title: 'New Friend Request!',
                        text: `Incoming friend request from user ${name} (${id}).`,
                        icon: 'info',
                        showDenyButton: true,
                        confirmButtonColor: '#3085d6',
                        denyButtonColor: '#d33',
                        confirmButtonText: 'Accept',
                        denyButtonText: 'Reject',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                    });
                    if (res.isDenied) {
                        Swal.fire('Friend request not accepted.', '', 'info');
                        socket.send(JSON.stringify({ type: 'REQUEST_ACTION', data: { id: id, type: 'ACCEPT' } }));
                    } else if (res.isConfirmed) {
                        Swal.fire('Friend request successfully accepted!', '', 'success');
                        socket.send(JSON.stringify({ type: 'REQUEST_ACTION', data: { id: id, type: 'ACCEPT' } }));
                    }
                }
                break;
            case 'UPDATE_TOKEN':
                let { token } = data.data;
                localStorage.token = token;
                break;
            case 'Error!':
                let { type, message } = data;
                Swal.fire(type, message, 'error')
                break;
        }
    };

    const addFriend = document.createElement('button');
    const text1 = document.createTextNode('Add Friend');
    addFriend.appendChild(text1);
    addFriend.style = 'position: relative; width:100px; height:50px; border-radius: 12px; background: linear-gradient(135deg, #6e8efb, #a777e3); font-family: "Ubuntu"; display: none;';
    document.body.appendChild(addFriend);
    addFriend.onclick = async function() {
        const { value: id } = await Swal.fire({
            title: 'Enter the UserID or Name of the person you want to be friends with!',
            input: 'text',
            focusConfirm: false,
            inputValidator: function(val) {
                if (!val || val.length !== 4) return 'Please enter a valid UserID.';
            },
        });

        if (id) {
            socket.send(JSON.stringify({
                type: 'ADD_FRIEND',
                data: { id: id },
            }));

            await Swal.fire('Success!', 'Sent friend request successfully!', 'success');
        }
    }

    const removeFriend = document.createElement('button');
    const text2 = document.createTextNode('Remove Friend');
    removeFriend.appendChild(text2);
    document.body.appendChild(removeFriend);
    removeFriend.style = 'position: relative; width:100px; height:50px; border-radius: 12px; background: linear-gradient(135deg, #6e8efb, #a777e3); font-family: "Ubuntu"; display: none;';
    removeFriend.onclick = async function() {
        const { value: id } = await Swal.fire({
            title: 'Enter the User ID of the person you want to remove as a friend!',
            input: 'text',
            focusConfirm: false,
            inputValidator: function(val) {
                if (!val || val.length !== 4) return 'Please enter a valid UserID.';
            }
        });

        if (id) {
            socket.send(JSON.stringify({
                type: 'REMOVE_FRIEND',
                data: { id: id },
            }));

            await Swal.fire('Success!', 'Removed user as a friend!', 'success');
        }
    }


    const removeRequest = document.createElement('button');
    const text3 = document.createTextNode('Delete Friend Request');
    removeRequest.appendChild(text3);
    document.body.appendChild(removeRequest);
    removeRequest.style = 'position: relative; width:100px; height:50px; border-radius: 12px; background: linear-gradient(135deg, #6e8efb, #a777e3); font-family: "Ubuntu"; display: none;';
    removeRequest.onclick = async function() {
        const { value: id } = await Swal.fire({
            title: 'Enter the User ID of the person you want to remove your pending friend request from!',
            input: 'text',
            focusConfirm: false,
            inputValidator: function(val) {
                if (!val || val.length !== 4) return 'Please enter a valid UserID.';
            }
        });

        if (id) {
            socket.send(JSON.stringify({
                type: 'REMOVE_REQUEST',
                data: { id: id },
            }));

            await Swal.fire('Success!', 'Removed pending friend request!', 'success');
        }
    }

    const findUserID = document.createElement('button');
    const text4 = document.createTextNode('Find UserID/Token');
    findUserID.appendChild(text4);
    document.body.appendChild(findUserID);
    findUserID.style = 'position: relative; width:100px; height:50px; border-radius: 12px; background: linear-gradient(135deg, #6e8efb, #a777e3); font-family: "Ubuntu"; display: none;';
    findUserID.onclick = async function() {
        Swal.fire({ title: 'User ID & User Token', icon: 'info', html: `❗DO NOT SHARE TOKEN WITH ANYONE❗<br><br> User ID: ${localStorage.getItem('UserID')}<br><br> Name: ${localStorage.getItem('flName')} <br><br> User Token: ${localStorage.getItem('token')}`});
    }

    const currentRequests = document.createElement('button');
    const text5 = document.createTextNode('Requests');
    currentRequests.appendChild(text5);
    document.body.appendChild(currentRequests);
    currentRequests.style = 'position: relative; width:100px; height:50px; border-radius: 12px; background: linear-gradient(135deg, #6e8efb, #a777e3); font-family: "Ubuntu"; display: none;';
    currentRequests.onclick = async function() {
        Swal.fire({ title: 'Current Friends & Pending Friends (Reload for accurate results)', icon: 'info', html: `Current Friends: ${friends.length ? friends.join(', ') : 'No current friends.'}<br><br>Pending Friends: ${requests.length ? requests.join(', ') : 'No current pending requests.'}`})
    }

    const toggle = document.createElement('button');
    const text6 = document.createTextNode('Disable Script');
    toggle.appendChild(text6);
    document.body.appendChild(toggle);
    toggle.style = 'position: relative; width:100px; height:50px; border-radius: 12px; background: linear-gradient(135deg, #6e8efb, #a777e3); font-family: "Ubuntu"; display: none;';
    toggle.onclick = async function() {
        scriptEnabled = !scriptEnabled;
        if (scriptEnabled)
            toggle.innerText = 'Disable Script';
        else
            toggle.innerText = 'Enable Script';
    }

    const changeName = document.createElement('button');
    const text7 = document.createTextNode('Change Name');
    changeName.appendChild(text7);
    document.body.appendChild(changeName);
    changeName.style = 'position: relative; width:100px; height:50px; border-radius: 12px; background: linear-gradient(135deg, #6e8efb, #a777e3); font-family: "Ubuntu"; display: none;';
    changeName.onclick = async function() {
        const { value: name } = await Swal.fire({
            title: 'Enter your new name!',
            input: 'text',
            focusConfirm: false,
            inputValidator: function(val) {
                if (!val) return 'Please enter a valid name.';
                if (val.length >= 16) return 'Username character limit is 16 characters.';
            }
        });

        socket.send(JSON.stringify({
            type: 'CHANGE_NAME',
            data: { name: name, token: localStorage.token },
        }));
    }

    api.on("pre.key.down", function({ code }) {
        switch (code) {
            case 'Comma': {
                if (document.getElementById('textInput') === document.activeElement && !event.shiftKey && !guiEnabled) return;
                guiEnabled = !guiEnabled;

                if (!guiEnabled) {
                    addFriend.style.display = 'none';
                    removeFriend.style.display = 'none';
                    removeRequest.style.display = 'none';
                    findUserID.style.display = 'none';
                    currentRequests.style.display = 'none';
                    toggle.style.display = 'none';
                    changeName.style.display = 'none';
                } else {
                    addFriend.style.display = 'block';
                    removeFriend.style.display = 'block';
                    removeRequest.style.display = 'block';
                    findUserID.style.display = 'block';
                    currentRequests.style.display = 'block';
                    toggle.style.display = 'block';
                    changeName.style.display = 'block';
                }

                api.preventing_keys = guiEnabled;
                break;
            }
            case 'Enter': {
                api.preventing_keys = socket.readyState !== 1;
            }
        }
    });

    setInterval(function() {
        if (scriptEnabled && socket.readyState == 1 && JSON.stringify([api.player.x, api.player.y]) !== '[null,null]') socket.send(JSON.stringify({ type: 'SEND_COORS', data: { server: serverID, position: [api.player.x, api.player.y] } }));
        if (!scriptEnabled)
            socket.send(JSON.stringify({ type: 'SEND_COORS', data: { server: serverID, position: ['ending', 'ending'] } }));
    }, sending_interval);
});
