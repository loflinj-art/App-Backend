const express = require("express");
const app = express();
const http = require("http").Server(app);
const cors = require("cors");
// Initialize socket.io with the http server and CORS options
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
    // This part correctly prepares the data without messages
    const groupsWithoutMessages = chatgroups.map(group => {
      const { messages, ...groupWithoutMessages } = group;
      return groupWithoutMessages;
    });
    socket.emit("groupList", groupsWithoutMessages); 
    console.log("sent all groups wihtout messages");
  });

  socket.on("createNewGroup", (currentGroupName) => {
    console.log(`Creating and Joining group: ${currentGroupName}`);
    const newGroup = {
      id: chatgroups.length + 1,
      currentGroupName, // This name serves as the Socket.IO room name
      messages: [],
    };
    chatgroups.unshift(newGroup);

    // Prepare the public list data *after* updating chatgroups
    const groupsWithoutMessages = chatgroups.map(group => {
      const { messages, ...groupWithoutMessages } = group;
      return groupWithoutMessages;
    });

    // CRITICAL FIX 1: You must join the *string* name of the room, not the array of groups
    socket.join(newGroup.currentGroupName); 

    // CRITICAL FIX 2: You intended to emit the list *without* messages, 
    // but were sending the full 'chatgroups' array
    socket.emit("groupList", groupsWithoutMessages); 
  });

  socket.on("findGroup", (id) => {
    const filteredGroups = chatgroups.filter((item) => item.id === id);
    if (filteredGroups.length > 0) {
        const group = filteredGroups[0];
        // FIX 2: The joining user must join the specific Socket.IO room
        socket.join(group.currentGroupName); 
        socket.emit("foundGroup", group.messages);
        console.log(`Socket ${socket.id} joined room: ${group.currentGroupName}`);
    }
  });

  socket.on("newChatMessage", (data) => {
    const { positionData, groupIdentifier, currentUser, timeData } = data;
    
    // Find the group object using its numeric ID
    const groupIndex = chatgroups.findIndex((item) => item.id === groupIdentifier);

    if (groupIndex === -1) return; // Exit if group not found
    
    const group = chatgroups[groupIndex];
    const roomName = group.currentGroupName; // Get the string name of the room for broadcasting

    const newMessage = {
      id: createUniqueId(),
      text: `${positionData.latitude}, ${positionData.longitude}, ${positionData.speed}, ${positionData.heading}`, // Example message format
      user: currentUser,
      time: `${timeData.hr}:${timeData.mins}:${timeData.secs}`,
    };

    // Update the server's state first
    chatgroups[groupIndex].messages.push(newMessage);
    
    // *** FIX 3a: Broadcast to every OTHER client in the room EXCEPT the sender ***
    // `socket.broadcast` sends the message to all connected clients *except* the one who emitted the event.
    // `.to(roomName)` targets only the clients currently in that specific group's room.
    socket.broadcast.to(roomName).emit("groupMessage", newMessage);
  });
  
  socket.on("disconnect", () => {
      console.log(`${socket.id} user disconnected`);
      // You may want to add logic here to remove users from rooms or general online user lists
  });
});

app.get("/api", (req, res) => {
  // This API route still exposes all data, including messages. 
  // You might want to apply the same filtering logic here if you want consistency.
  res.json(chatgroups);
});

http.listen(PORT, () => {
  console.log(`Server is listeing on ${PORT}`);
});
