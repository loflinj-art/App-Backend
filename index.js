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

// Helper function remains the same
function createUniqueId() {
  return Math.random().toString(20).substring(2, 10);
}

// Data structure: An array of group objects
let chatgroups = [];

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

socketIO.on("connection", (socket) => {
  console.log(`${socket.id} user is just connected`);

  // Helper function to prepare data for public display (without messages)
  const getGroupsWithoutMessages = () => {
    return chatgroups.map(group => {
      const { messages, ...groupWithoutMessages } = group;
      return groupWithoutMessages;
    });
  };

  socket.on("getAllGroups", () => {
    socket.emit("groupList", getGroupsWithoutMessages()); 
    console.log("sent all groups without messages");
  });

  socket.on("createNewGroup", (currentGroupName) => {
    console.log(`Creating and Joining group: ${currentGroupName}`);
    const newGroup = {
      id: chatgroups.length + 1,
      currentGroupName: currentGroupName, // Use the provided name as the room identifier
      messages: [],
    };
    chatgroups.unshift(newGroup);

    // CRITICAL FIX 1: Join the specific Socket.IO room by its *string* name
    socket.join(newGroup.currentGroupName); 

    // Emit the updated list of groups to the client who created the group
    socket.emit("groupList", getGroupsWithoutMessages()); 
  });

  socket.on("findGroup", (id) => {
    // Find the group object based on the numeric ID
    const foundGroup = chatgroups.find((item) => item.id === id);
    
    if (foundGroup) {
        // CRITICAL FIX 2: The joining user must join the specific Socket.IO room *string* name
        socket.join(foundGroup.currentGroupName); 
        
        // You can emit back details of the specific group found (including messages this time, maybe?)
        // Or just confirm they joined and send the general list. We'll stick to the original emit for now.
        socket.emit("foundGroup", getGroupsWithoutMessages());
        console.log(`Socket ${socket.id} joined room: ${foundGroup.currentGroupName}`);
    } else {
        console.log(`Group with ID ${id} not found.`);
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

    // 1. Update the server's state first
    chatgroups[groupIndex].messages.push(newMessage);
    
    // 2. Send the message back to the SENDER so their UI updates immediately
    // If you want the sender to update their own UI instantly without waiting for a socket response, 
    // you don't even need this line. But if you want confirmation via socket, this is one way.
    socket.emit("groupMessage", newMessage); 

    // CRITICAL FIX 3: Broadcast to every OTHER client in the room EXCEPT the sender
    // `socket.broadcast` targets everyone *except* the initial sender.
    // `.to(roomName)` targets only the clients currently in that specific group's room.
    socket.broadcast.to(roomName).emit("groupMessage", newMessage);
  });
  
  socket.on("disconnect", () => {
      console.log(`${socket.id} user disconnected`);
      // When a socket disconnects, Socket.IO automatically removes it from all rooms it joined.
  });
});

app.get("/api", (req, res) => {
  // This API route still exposes all data, including messages, which is fine for debugging.
  res.json(chatgroups);
});

http.listen(PORT, () => {
  console.log(`Server is listening on ${PORT}`);
});
