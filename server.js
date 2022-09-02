const WS = require("ws");
const wss = new WS.Server({ port: process.env.PORT || 8080 });
const fs = require("fs");

const atob = require("atob");
const btoa = require("btoa");

const users = require("./users.json");
const theme = require("./themes.json");

wss.on("connection", function (WebSocket, req) {
  console.log("WebSocket connection with client has been established.");

  WebSocket.onmessage = function ({ data }) {
    try {
      data = JSON.parse(data);
    } catch (err) {
      WebSocket.close();
    }

    const header = data.type;

    switch (header) {
      case "IDENTIFY":
        let { token, themes, color } = data.data;
        
        try {
          atob(token);
        } catch (err) {
          WebSocket.close();
        }

        let identifier = atob(token).substring(0, 4);
        let name = atob(token).split(" + ")[1];

        WebSocket.id = identifier;

        if (!users[identifier]) {
          users[identifier] = {
            friends: [],
            color: color,
            token: token,
            name: name,
            outgoingRequests: [],
            incomingRequests: [],
          };

          fs.writeFileSync("./users.json", JSON.stringify(users, null, 4));
        }

        theme[`${identifier} + ${Date.now()}`] = themes; // in case I ever want to check UI Scale serverside
        fs.writeFileSync("./themes.json", JSON.stringify(theme, null, 4));

        setTimeout(function () {
          WebSocket.send(
            JSON.stringify({
              type: "SEND_REQUESTS",
              data: {
                outgoingRequests: users[identifier].outgoingRequests,
                incomingRequests: users[identifier].incomingRequests,
              },
            })
          );

          WebSocket.send(
            JSON.stringify({
              type: "SEND_FRIENDS",
              data: { friends: users[identifier].friends },
            })
          );
        }, 2000);
        break;
      case "CHANGE_NAME": {
        let { name, token } = data.data;
        
        let identifier = atob(token).substring(0, 4);
        let newToken = btoa(`${identifier} + ${name}`);

        
        let isUnique = true;
        
        Object.entries(users).forEach(function(key, value) {
          if (value.name === name && identifier === key) {
            isUnique = false;
          }
        });
        
        if (!isUnique)
            WebSocket.send(
              JSON.stringify({
                type: "Error!",
                message: "Another user has the same exact name and identifier.",
              })
            );
        else
          WebSocket.send(
            JSON.stringify({
              type: "UPDATE_TOKEN",
              data: { token: newToken },
            })
          );
        break;
      }
      case "ADD_FRIEND": {
        let { id } = data.data;
        let UserID = WebSocket.id;

        if (!Object.keys(users).includes(id))
          return WebSocket.send(
            JSON.stringify({
              type: "Error!",
              message: "Invalid ID.",
            })
          );

        if (id === WebSocket.id)
          return WebSocket.send(
            JSON.stringify({
              type: "Error!",
              message: "You cannot friend request yourself.",
            })
          );
        if (users[WebSocket.id].friends.includes(id))
          return WebSocket.send(
            JSON.stringify({
              type: "Error!",
              message: "That user is already friends with you!",
            })
          );
        if (users[WebSocket.id].outgoingRequests.includes(id))
          return WebSocket.send(
            JSON.stringify({
              type: "Error!",
              message: "You already sent a request to that user.",
            })
          );

        if (![...wss.clients].filter((client) => client.id === id).length > 0)
          return WebSocket.send(
            JSON.stringify({
              type: "Error!",
              message: "User is not online.",
            })
          );

        const name = users[UserID].name;
        
        users[id].incomingRequests.push([UserID, name]);
        users[UserID].outgoingRequests.push(id);
        fs.writeFileSync("./users.json", JSON.stringify(users, null, 4));
        break;
      }
      case "REQUEST_ACTION":
        let { id, type } = data.data;

        switch (type) {
          case "ACCEPT": {
            const UserID = WebSocket.id;
            const name = users[UserID];
            
            const index1 = users[id].outgoingRequests.indexOf(id);
            const index2 = users[UserID].incomingRequests.indexOf([UserID, name]);

            if (index1 === -1 || index2 === -1)
              return WebSocket.send(
                JSON.stringify({
                  type: "Error!",
                  message: "That friend request no longer exists.",
                })
              );

            users[id].outgoingRequests.splice(index1, 1);
            users[UserID].incomingRequests.splice(index2, 1);

            users[id].friends.push(UserID);
            [...wss.clients]
              .filter((client) => client.id === id)[0]
              .send(
                JSON.stringify({
                  type: "UPDATE_FRIENDS",
                  data: { friends: users[id].friends },
                })
              );

            users[UserID].friends.push(id);
            [...wss.clients]
              .filter((client) => client.id === UserID)[0]
              .send(
                JSON.stringify({
                  type: "UPDATE_FRIENDS",
                  data: { friends: users[UserID].friends },
                })
              );

            fs.writeFileSync("./users.json", JSON.stringify(users, null, 4));
            break;
          }
          case "REJECT":
            const UserID = WebSocket.id;
            const name = users[id];
            const index1 = users[id].outgoingRequests.indexOf(UserID);
            const index2 = users[UserID].incomingRequests.indexOf([id, name]);

            if (index1 === -1 || index2 === -1)
              return WebSocket.send(
                JSON.stringify({
                  type: "Error!",
                  message: "That friend request no longer exists.",
                })
              );

            users[id].outgoingRequests.splice(index1, 1);
            users[UserID].incomingRequests.splice(index2, 1);

            fs.writeFileSync("./users.json", JSON.stringify(users, null, 4));
        }
        break;
      case "REMOVE_FRIEND": {
        let { id } = data.data;

        const UserID = WebSocket.id;

        const index1 = users[id].friends.indexOf(UserID);
        const index2 = users[UserID].friends.indexOf(id);

        if (index1 === -1 || index2 === -1) {
          return WebSocket.send(
            JSON.stringify({
              type: "Error!",
              message: "That user is not on your friends list.",
            })
          );
        }

        users[id].friends.splice(index1, 1);
        users[UserID].friends.splice(index2, 1);
        [...wss.clients]
          .filter((client) => client.id === UserID)[0]
          .send(
            JSON.stringify({
              type: "UPDATE_FRIENDS",
              data: { friends: users[UserID].friends },
            })
          );
        fs.writeFileSync("./users.json", JSON.stringify(users, null, 4));
      }
      case "REMOVE_REQUEST": {
        let { id } = data.data;

        const UserID = WebSocket.id;
        const name = users[UserID];
        const index1 = users[id].incomingRequests.indexOf([UserID, name]);
        const index2 = users[UserID].outgoingRequests.indexOf(id);

        if (index1 === -1)
          return WebSocket.send(
            JSON.stringify({
              type: "Error!",
              message: "That friend request no longer exists.",
            })
          );

        users[id].incomingRequests.splice(index1, 1);
        users[UserID].outgoingRequests.splice(index2, 1);

        fs.writeFileSync("./users.json", JSON.stringify(users, null, 4));
        break;
      }
      case "SEND_COORS":
        data = data.data;
        WebSocket.server = data.server;

        const payload = {
          type: "RECEIVE_COORS",
          data: data,
          user: WebSocket.id,
          name: users[WebSocket.id].name,
          color: users[WebSocket.id].color,
        };

        users[WebSocket.id].friends.map((friend) => {
          if (
            [...wss.clients].filter((client) => client.id === friend).length > 0
          ) {
            [...wss.clients]
              .filter((client) => client.id === friend)[0]
              .send(JSON.stringify(payload));
          }
        });

        break;
    }
  };

  WebSocket.onclose = function () {
    console.log("WebSocket connection with client has closed.");
    users[WebSocket.id].friends.map((friend) => {
      if (
        [...wss.clients].filter((client) => client.id === friend).length > 0
      ) {
        [...wss.clients]
          .filter((client) => client.id === friend)[0]
          .send(
            JSON.stringify({
              type: "RECEIVE_COORS",
              data: {
                position: ["ending", "ending"],
                server: WebSocket.server,
              },
              user: WebSocket.id,
            })
          );
      }
    });
  };
});
