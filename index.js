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

    // Join the specific Socket.IO room by its *string* name
    socket.join(newFlight.currentFlightName); 

    // Emit the updated list of flights to the client who created the flight
    socketIO.emit("flightList", getFlightsWithoutDatas()); //send list to everyone (socketIO.emit)
  });

  socket.on("joinFlight", (id) => {
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

// *** MODIFIED HANDLER BELOW (Ensures existence AND user join status) ***
  socket.on("newFlightData", (data) => {
   const { positionData, flightName, currentUser, currentUserRole, timeData } = data;
    
    let flightIndex = chatflights.findIndex((item) => item.currentFlightName === flightName);

    // If the flight does NOT exist, create it automatically
    if (flightIndex === -1) {
        console.log(`Flight ${flightName} not found. Creating a new one automatically.`);
        const newFlight = {
            id: chatflights.length + 1,
            currentFlightName: flightName,
            datas: [],
        };
        chatflights.unshift(newFlight);
        flightIndex = 0;

        // Alert all other connected clients that a new flight appeared in the list
        socketIO.emit("flightList", getFlightsWithoutDatas());
    }

    // THIS IS THE KEY CHANGE: Ensure the sender is ALWAYS in the room before broadcasting
    if (!socket.rooms.has(flightName)) {
         socket.join(flightName);
         console.log(`Socket ${socket.id} automatically joined room: ${flightName} before sending data.`);
    }

    // Now proceed with adding the data to the existing (or newly created) flight
    const newData = {
      id: createUniqueId(),
      text: `${positionData.latitude}, ${positionData.longitude}, ${positionData.speed}, ${positionData.heading}`,
      user: currentUser,
      role: currentUserRole,
      time: `${timeData.hr}:${timeData.mins}:${timeData.secs}`,
    };

    chatflights[flightIndex].datas.push(newData);
    
    // The sender receives the data immediately because they are using `socket.broadcast` 
    // which sends to everyone *except* the sender. If you also want the sender's UI 
    // to update via socket confirmation (not just locally on the client), you'd add:
    // socket.emit("flightData", newData); 

    // Broadcast to every OTHER client in the room
    socket.broadcast.to(flightName).emit("flightData", newData);
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
