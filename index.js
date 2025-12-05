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

// Data structure: An array of flight objects
let chatflights = [];

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

socketIO.on("connection", (socket) => {
  console.log(`${socket.id} user is just connected`);

  // Helper function to prepare data for public display (without datas)
  const getFlightsWithoutDatas = () => {
    return chatflights.map(flight => {
      const { datas, ...flightWithoutDatas } = flight;
      return flightWithoutDatas;
    });
  };

  socket.on("getAllFlights", () => {
    socket.emit("flightList", getFlightsWithoutDatas()); 
    console.log("sent all flights without datas");
  });

  socket.on("createNewFlight", (currentFlightName) => {
    console.log(`Creating and Joining flight: ${currentFlightName}`);
    const newFlight = {
      id: chatflights.length + 1,
      currentFlightName: currentFlightName, // Use the provided name as the room identifier
      datas: [],
    };
    chatflights.unshift(newFlight);

    // CRITICAL FIX 1: Join the specific Socket.IO room by its *string* name
    socket.join(newFlight.currentFlightName); 

    // Emit the updated list of flights to the client who created the flight
    socketIO.emit("flightList", getFlightsWithoutDatas()); //send list to everyone (socketIO.emit)
  });

  socket.on("findFlight", (id) => {
    // Find the flight object based on the numeric ID
    const joinedFlight = chatflights.find((item) => item.id === id);
    
    if (joinedFlight) {
        // CRITICAL FIX 2: The joining user must join the specific Socket.IO room *string* name
        socket.join(joinedFlight.currentFlightName); 
        
        // You can emit back details of the specific flight found (including datas this time, maybe?)
        // Or just confirm they joined and send the general list. We'll stick to the original emit for now.
        socket.emit("joinedFlight", getFlightsWithoutDatas());
        console.log(`Socket ${socket.id} joined room: ${joinedFlight.currentFlightName}`);
    } else {
        console.log(`Flight with ID ${id} not found.`);
    }
  });

  socket.on("newFlightData", (data) => {
    const { positionData, flightIdentifier, currentUser, timeData } = data;
    
    // Find the flight object using its numeric ID
    const flightIndex = chatflights.findIndex((item) => item.id === flightIdentifier);

    if (flightIndex === -1) return; // Exit if flight not found
    
    const flight = chatflights[flightIndex];
    const roomName = flight.currentFlightName; // Get the string name of the room for broadcasting

    const newData = {
      id: createUniqueId(),
      text: `${positionData.latitude}, ${positionData.longitude}, ${positionData.speed}, ${positionData.heading}`, // Example data format
      user: currentUser,
      time: `${timeData.hr}:${timeData.mins}:${timeData.secs}`,
    };

    // 1. Update the server's state first
    chatflights[flightIndex].datas.push(newData);
    
    // 2. Send the data back to the SENDER so their UI updates immediately
    // If you want the sender to update their own UI instantly without waiting for a socket response, 
    // you don't even need this line. But if you want confirmation via socket, this is one way.
    //socket.emit("flightData", newData); 

    // CRITICAL FIX 3: Broadcast to every OTHER client in the room EXCEPT the sender
    // `socket.broadcast` targets everyone *except* the initial sender.
    // `.to(roomName)` targets only the clients currently in that specific flight's room.
    socket.broadcast.to(roomName).emit("flightData", newData);
  });
  
  socket.on("disconnect", () => {
      console.log(`${socket.id} user disconnected`);
      // When a socket disconnects, Socket.IO automatically removes it from all rooms it joined.
  });
});

app.get("/api", (req, res) => {
  // This API route still exposes all data, including datas, which is fine for debugging.
  res.json(chatflights);
});

http.listen(PORT, () => {
  console.log(`Server is listening on ${PORT}`);
});
