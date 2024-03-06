import { exec } from "child_process";
import { BlockFrostAPI } from "@blockfrost/blockfrost-js";

const senderAddress =
  "addr1v886mdrvp2a7v8h4egxdplsdfh6w8lh8977xrk07qvye7wcttcjcc";
const receiverAddress =
  "addr1q8ctsz48ngjq635sh8u6xng4yz53g6482f57ajly2s03y7fpgsurfgqmwdr7m4u2x52fzj8mrcufll0f2r8qmm3xg8rsp0jt8f";

interface Utxo {
  txHash: string;
  txIx: number;
  lovelace: string;
  assets: string;
}

const API = new BlockFrostAPI({
  projectId: "mainnetqd6fAVK8JeFWSM3aWPK5uQCFRHGgm7SR",
});

export async function getUTXOs() {
  try {
    // Fetch UTXOs for the given wallet address
    let utxos: any = await API.addressesUtxos(senderAddress);
    let slot: any = (await API.blocksLatest()).slot;
    let fee: number = 0;
    const maxUtxo = 30;
    // Map UTXOs to extract relevant information
    utxos = utxos.map((utxo: any) => {
      return {
        txHash: utxo.tx_hash,
        txIx: utxo.tx_index,
        amount: utxo.amount,
      };
    });

    let formattedUTXOs: any = formatUtxo(utxos, receiverAddress, fee, maxUtxo);
    
    buildTransaction(formattedUTXOs.txOut, formattedUTXOs.txIn, slot, fee);
    fee = await calculateMinFee("tx.raw", maxUtxo, 3, 2, true, "protocol.json");
    const newUtxos = formatUtxo(utxos, receiverAddress, fee, maxUtxo);
    await buildTransaction(newUtxos.txOut, newUtxos.txIn, slot, fee);
    await signTransaction("tx.raw", "nurseryAddress.skey", true, "tx.signed");
    
    await submitTransaction("tx.signed", true) // Assuming tx.signed is the path to the signed transaction file
    const txhash = await getTransactionId('tx.signed');
    return txhash;

  } catch (error) {
    console.error("Error fetching UTXOs:", error);
    return null;
  }
}

function formatUtxo(formattedUTXOs: any, walletAddress: string, fee: number, maxUtxo: number) {
  let lovelace = 0;
  let txoutput: string = "";
  let txinput: string = "";


  for (let i = 0; i < maxUtxo && i < formattedUTXOs.length; i++) {
    const tempAssets = formattedUTXOs[i].amount;
    lovelace += parseInt(tempAssets[0].quantity);
    // Create txinput string
    if (i != 0) {
      txinput += " ";
    }
    txinput += `--tx-in ${formattedUTXOs[i].txHash}#${formattedUTXOs[i].txIx}`;

    for (let j = 1; j < tempAssets.length; j++) {
      const splitIndex =
        tempAssets[j].unit.indexOf(
          "23e8f1b1e62da63b08b0c07b6fdf65d89e878cb70de03c6d6b0970e4"
        ) + "23e8f1b1e62da63b08b0c07b6fdf65d89e878cb70de03c6d6b0970e4".length;
      const firstPart = tempAssets[j].unit.substring(0, splitIndex);
      const secondPart = tempAssets[j].unit.substring(splitIndex);
      txoutput += `${j > 0 ? " + " : ""}${
        tempAssets[j].quantity
      } ${firstPart}.${secondPart}`;
    }
  }

  const txOut = `${walletAddress} + ${lovelace-fee}${txoutput}`;
  return { txOut: txOut, txIn: txinput };
}

function buildTransaction(txOut: string, txIn: string, slot: number, fee: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const command = `cardano-cli transaction build-raw --babbage-era ${txIn} --tx-out "${txOut}" --invalid-hereafter ${slot + 2000} --fee ${fee} --out-file tx.raw`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`Error in command execution: ${stderr}`);
                reject(new Error(stderr));
                return;
            }
            console.log(`Transaction built successfully: ${stdout}`);
            resolve();
        });
    });
}

function calculateMinFee(txBodyFile: string, txInCount: number, txOutCount: number, witnessCount: number, mainnet: boolean, protocolParamsFile: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const network = "--mainnet"; // Use --mainnet or --testnet based on the network
        const command = `cardano-cli transaction calculate-min-fee \
            --tx-body-file ${txBodyFile} \
            --tx-in-count ${txInCount} \
            --tx-out-count ${txOutCount} \
            --witness-count ${witnessCount} \
            ${network} \
            --protocol-params-file ${protocolParamsFile}`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`Error executing command: ${error.message}`);
                return;
            }
            if (stderr) {
                reject(`Error in command execution: ${stderr}`);
                return;
            }
            const fee = parseInt(stdout.trim()); // Parse fee from stdout and convert it to a number
            if (isNaN(fee)) {
                reject(`Failed to parse fee as a number: ${stdout}`);
                return;
            }
            resolve(fee);
        });
    });
}

function signTransaction(
    txBodyFile: string,
    signingKeyFile: string,
    mainnet: boolean,
    outFile: string
  ): Promise<void> {
    const network = mainnet ? "--mainnet" : "--testnet";
    const command = `cardano-cli transaction sign \
      --tx-body-file ${txBodyFile} \
      --signing-key-file ${signingKeyFile} \
      ${network} \
      --out-file ${outFile}`;
  
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing command: ${error.message}`);
          reject(error);
          return;
        }
        if (stderr) {
          console.error(`Error in command execution: ${stderr}`);
          reject(new Error(stderr));
          return;
        }
        console.log(`Transaction signed successfully. Output file: ${outFile}`);
        resolve();
      });
    });
  }

function submitTransaction(txFile: string, mainnet: boolean): Promise<string> {
    return new Promise((resolve, reject) => {
        const network = mainnet ? "--mainnet" : "--testnet"; // Use --mainnet or --testnet based on the network
        const command = `cardano-cli transaction submit \
            --tx-file ${txFile} \
            ${network}`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(error);
                
                reject(`Error executing command: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(stderr);
                reject(`Error in command execution: ${stderr}`);
                return;
            }
            // Transaction successfully submitted
            console.log("success!");
            resolve(stdout.trim());
        });
    });
}

function getTransactionId(txFile: string): Promise<string> {
    const command = `cardano-cli transaction txid --tx-file ${txFile}`;
  
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing command: ${error.message}`);
          reject(error);
          return;
        }
        if (stderr) {
          console.error(`Error in command execution: ${stderr}`);
          reject(new Error(stderr));
          return;
        }
        // Extract transaction ID from the stdout
        const txid = stdout.trim();
        console.log(`Transaction ID: ${txid}`);
        resolve(txid);
      });
    });
  }
  

