import express, { Express, Request, Response, Application } from "express";
import dotenv from "dotenv";
import { getUTXOs } from "./util/cli";

//For env File
dotenv.config();

const app: Application = express();
const port = process.env.PORT;

app.get("/", (req: Request, res: Response) => {
  
  getUTXOs()
    .then((utxos) => {
      res.json(utxos)
    })
    .catch((error) => {
      console.error("Error querying wallet address:", error);
    });
});

// Define the interval in milliseconds (3 minutes = 180000 milliseconds)
const interval = 180000;

// Function to fetch UTXOs every 3 minutes
function fetchUTXOs() {
  getUTXOs()
    .then((utxos) => {
      console.log("UTXOs fetched successfully at:", new Date());
    })
    .catch((error) => {
      console.error("Error fetching UTXOs:", error);
    });
}

// Call the function immediately and then at every interval
fetchUTXOs(); // Call immediately
setInterval(fetchUTXOs, interval); // Call every 3 minutes

app.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});
