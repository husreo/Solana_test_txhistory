"use client"

import Image from "next/image";
import { useState } from "react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import axios from "axios";
import dotenv from 'dotenv'
import { blob } from "stream/consumers";

const dexscreenapi = 'https://api.dexscreener.com/latest/dex/tokens/'

const solanaConnection = new Connection("https://mainnet.helius-rpc.com/?api-key=c2d64354-14be-496d-b755-a55b599bfbf8", { wsEndpoint: "wss://mainnet.helius-rpc.com/?api-key=c2d64354-14be-496d-b755-a55b599bfbf8" });

enum Filter {
    Receive,
    Send,
    Both
}

export default function Home() {
  type dataType = {
    type: string,
    signature: string,
    from: string,
    to: string,
    date: string,
    amount: number,
    symbol: string 
  }
  const [filter, setFilter] = useState('receive');
  const [wallet, setWallet] = useState('');
  const [token, setToken] = useState('');
  const [walletAlert, openWalletAlret] = useState(false);
  const [tokentAlert, openTokentAlert] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>();

  const getHistory = async (pubkey: PublicKey, mint: PublicKey, filter: Filter) => {
    const history_result: Array<{
        signature: string,
        from: string,
        to: string,
        date: string,
        amount: string,
        symbol: string
        type: string
    }> = []
    
    const ata = getAssociatedTokenAddressSync(mint, pubkey)

    const history = await solanaConnection.getSignaturesForAddress(ata)
    // fs.writeFileSync('history.json', JSON.stringify(history, null, 4))
    
    const symbol = await getSymbol(mint)

    for (let i = 0; i < history.length; i++) {
        if (history[i].err == null) {
            const decoded = await solanaConnection.getParsedTransaction(history[i].signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
            })
            if (decoded) {
                const data = await getInfo(decoded, pubkey, ata, solanaConnection, filter)
                if (data) {
                    history_result.push({ signature: history[i].signature, from: data.from, to: data.to, date: formatDate(history[i].blockTime! * 1000), amount: data.amount, symbol, type: data.type })
                }
            }
        }
    }

    return history_result;
  }

  const getInfo = async (decoded: ParsedTransactionWithMeta, pubkey: PublicKey, ata: PublicKey,       solanaConnection: Connection, filter: Filter) => {
      if (decoded?.meta?.logMessages?.toString().includes('TransferChecked')) {
          const inx = decoded.transaction.message?.instructions
          for (const item of inx) {
              // @ts-ignore
              if (item.parsed && item.parsed.type == 'transferChecked') {
                  // @ts-ignore
                  const { destination, source, tokenAmount, mint } = item.parsed.info
                  const amount = tokenAmount.uiAmount
                  if (destination.toString() == ata.toString() && (filter == Filter.Receive || filter == Filter.Both)) {
                      const sourceAcc = await solanaConnection.getParsedAccountInfo(new PublicKey(source))
                      // @ts-ignore
                      const owner = sourceAcc.value?.data.parsed.info.owner
                      if (owner) {
                          // type: 'receive'
                          return { type: 'receive', from: owner, to: pubkey.toString(), amount }
                      }
                      else return undefined
                  } else if (source.toString() == ata.toString() && (filter == Filter.Send || filter == Filter.Both)) {
                      const destinationAcc = await solanaConnection.getParsedAccountInfo(new PublicKey(destination))
                      // @ts-ignore
                      const owner = destinationAcc.value?.data.parsed.info.owner
                      if (owner) {
                          // type: 'send'
                          return { type: 'send', from: pubkey.toString(), to: owner, amount }
                      }
                      else return undefined
                  } else return undefined
              }
          }
          return undefined
      } else return undefined
  }

  const getSymbol = async (mint: PublicKey) => {
      const data = await axios.get(`${dexscreenapi}${mint.toString()}`)
      const pair = data.data.pairs[0]
      // console.log(pair)
      if (pair.baseToken.address = mint.toString()) return pair.baseToken.symbol
      if (pair.quoteToken.address = mint.toString()) return pair.quoteToken.symbol
  }

  function formatDate(timestamp: number): string {
      const date = new Date(timestamp);

      const months = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
      ];

      const month = months[date.getUTCMonth()];
      const day = date.getUTCDate();
      const year = date.getUTCFullYear();

      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      const seconds = date.getUTCSeconds().toString().padStart(2, '0');

      return `${month} ${day}, ${year} ${hours}:${minutes}:${seconds} +UTC`;
  }

  const fetchData = async () => {
    if (wallet === '' || token === '') {
      if (wallet === '') {
        openWalletAlret(true);
      }
      if (token === '') {
        openTokentAlert(true);
      }
      return;
    }
    setLoading(true);
    let filterType: Filter;
    if (filter === 'receive') {
      filterType = Filter.Receive
    } else if (filter === 'send') {
      filterType = Filter.Send
    } else {
      filterType = Filter.Both
    }
    const history = await getHistory(new PublicKey(wallet.trim()), new PublicKey(token.trim()), filterType);
    setData(history)
    console.log(history);
    setLoading(false);
  }
  return (
    <main className="flex min-h-screen flex justify-between p-4">
      <div className="flex flex-col gap-8 w-1/3">
        <div className="flex flex-col gap-2 w-1/2">
          <label  className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300">Wallet address</label>
          <input type="text" value={wallet} onChange={(e) => {setWallet(e.target.value); openWalletAlret(false)}}  placeholder="Wallet Address" className="px-3 py-1 border-transparent focus:border-transparent focus:ring-0" />
          <p className={`text-red-600 text-sm ${walletAlert? 'block':'hidden'}`}>Input wallet address</p>
          <label  className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300">Token address</label>
          <input type="text" value={token} onChange={(e) => {setToken(e.target.value); openTokentAlert(false)}} placeholder="Token Address" className="px-3 py-1 border-transparent focus:border-transparent focus:ring-0" />
          <p className={`text-red-600 text-sm ${tokentAlert? 'block':'hidden'}`}>Input wallet address</p>

        </div>
        <div className="flex flex-col gap-2 ">

          <div className="flex items-center">
            <input checked={filter === 'receive'} onChange={() => setFilter("receive")} id="default-radio-1" type="radio" value="" name="default-radio" className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
            <label className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300">Receive transactions</label>
          </div>
          <div className="flex items-center">
            <input checked={filter === 'send'} onChange={() => setFilter("send")} id="default-radio-2" type="radio" value="" name="default-radio" className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"/>
            <label  className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300">Send transactions</label>
          </div>
          <div className="flex items-center">
            <input checked={filter === 'both'} onChange={() => setFilter("both")} id="default-radio-2" type="radio" value="" name="default-radio" className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"/>
            <label  className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300">Send and Receive</label>
          </div>
        </div>
        <button className="bg-blue-600 text-white p-3 hover:bg-sky-700 w-[300px]" onClick={() => fetchData()} >Fetch Transaction</button>
      </div>
      <div className="w-2/3 p-2 overflow-auto h-[600px]">
        <p className={`${loading? 'block': 'hidden'}`}>Loading ....</p>
        <div className={`w-[2300px] h-[00px] ${loading || !data ? 'hidden': 'block'}`}>
          {/* <div className="p-1 flex border-b-2 border-y-blue-600">
            <p className="w-1/6">Signature</p>
            <p className="w-1/6">From</p>
            <p className="w-1/6">To</p>
            <p className="w-1/6">Date</p>
            <p className="w-1/6">Amount</p>
            <p className="w-1/6">Type</p>
          </div> */}
          {data?data.map((val, index) => <div className={`p-1 border-b-[1px] border-y-blue-600 ${loading? 'hidden':'block'}`} key={index}>
            {`${val.signature} | ${val.from} | ${val.to} | ${val.date} | ${val.amount} | ${val.type}`}
          </div>) : ''}
        </div>
      </div>
    </main>
  );
}
