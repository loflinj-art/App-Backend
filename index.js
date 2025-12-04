const express = require("express");
const app = express();
const http = require("http").Server(app);
const cors = require("cors");
const socketIO = require("socket.io")(http, {
  cors: {
    origin: "*", // update as necessary to restrict access
  },
});

const PORT = 4000;

function createUniqueId() {
  return Math.random().toString(20).substring(2, 10);
}

let chatgroups = [];

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

socketIO.on("connection", (socket) => {
  console.log(`${socket.id} user is just connected`);

  socket.on("getAllGroups", () => {
    socket.emit("groupList", chatgroups);
    console.log("sent all groups");
  });

  socket.on("createNewGroup", (currentGroupName) => {
    console.log(`Creating and Joining group: ${currentGroupName}`);
    const newGroup = {
      id: chatgroups.length + 1,
      currentGroupName,
      messages: [],
    };
    chatgroups.unshift(newGroup);

    // FIX 1: Make the creating user join the specific Socket.IO room
    socket.join(currentGroupName); 

    socket.emit("groupList", chatgroups);
  });

  socket.on("findGroup", (id) => {
    // Note: 'id' is a number, groupIdentifier is a number, currentGroupName is a string
    const filteredGroups = chatgroups.filter((item) => item.id === id);
    if (filteredGroups.length > 0) {
        const group = filteredGroups[0];
        // FIX 2: Make the joining user join the specific Socket.IO room
        socket.join(group.currentGroupName); 
        socket.emit("foundGroup", group.messages);
        console.log(`Socket ${socket.id} joined room: ${group.currentGroupName}`);
    }
  });

  socket.on("newChatMessage", (data) => {
    const { currentChatMesage, groupIdentifier, currentUser, timeData } = data;
    const filteredGroups = chatgroups.filter(
      (item) => item.id === groupIdentifier
    );
    
    if (filteredGroups.length === 0) return; // Exit if group not found
    
    const group = filteredGroups[0];
    const roomName = group.currentGroupName; // Get the string name of the room

    const newMessage = {
      id: createUniqueId(),
      text: currentChatMesage,
      currentUser,
      time: `${timeData.hr}:${timeData.mins}`,
    };

    // *** FIX 3: Broadcast to everyone in the room using the main 'socketIO' instance ***
    // This sends the message to *all* sockets that have called socket.join(roomName),
    // including the sender itself.
    socketIO.to(roomName).emit("groupMessage", newMessage);
    
    // Update the server's state
    group.messages.push(newMessage);
    
    // The following two lines might be redundant if your clients rely only on the 'groupMessage' listener:
    // socket.emit("groupList", chatgroups);
    // socket.emit("foundGroup", filteredGroup[0].messages);
  });
});

app.get("/api", (req, res) => {
  res.json(chatgroups);
});

http.listen(PORT, () => {
  console.log(`Server is listeing on ${PORT}`);
});
