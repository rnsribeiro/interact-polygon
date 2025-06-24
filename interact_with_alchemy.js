require('dotenv').config();
const { ethers } = require('ethers');

// Configurações
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// ABI do contrato UniqIDNFT
const CONTRACT_ABI = [
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "nftId",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "tokenId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "eventIndex",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "message",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			}
		],
		"name": "EventLogged",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "tokenId",
				"type": "bytes32"
			},
			{
				"internalType": "string",
				"name": "message",
				"type": "string"
			}
		],
		"name": "logEvent",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "tokenId",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "nftId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			}
		],
		"name": "NFTRegistered",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "tokenId",
				"type": "bytes32"
			}
		],
		"name": "registerNFT",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "_from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "_to",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "_tokenId",
				"type": "uint256"
			}
		],
		"name": "Transfer",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "eventCounts",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "nftId",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "eventIndex",
				"type": "uint256"
			}
		],
		"name": "getEventMessage",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "tokenId",
				"type": "bytes32"
			}
		],
		"name": "getNFTId",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "tokenId",
				"type": "bytes32"
			}
		],
		"name": "isTokenRegistered",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "nftId",
				"type": "uint256"
			}
		],
		"name": "ownerOf",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"name": "tokenIdToNFT",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

// Função principal para interagir com o contrato
async function interactWithContract() {
  try {
    // Conectar ao provedor Alchemy (Polygon Amoy)
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

    // Criar carteira a partir da chave privada
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    // Instanciar o contrato
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    // Exemplo 1: Calcular tokenId (HASH(EPC || TID))
    const epc = '0x3039ABCDEF1234567890'; // Exemplo do documento
    const tid = '0xE2003412012345678900'; // Exemplo do documento
    const tokenId = ethers.utils.keccak256(ethers.utils.concat([epc, tid]));
    console.log('TokenId calculado:', tokenId);

    // Exemplo 2: Verificar se tokenId está registrado
    const isRegistered = await contract.isTokenRegistered(tokenId);
    console.log('TokenId registrado?', isRegistered);

    if (!isRegistered) {
      // Exemplo 3: Registrar um novo NFT
      console.log('Registrando NFT...');
      const tx = await contract.registerNFT(tokenId, { gasLimit: 200000 });
      const receipt = await tx.wait();
      console.log('NFT registrado! Tx Hash:', receipt.transactionHash);

      // Exemplo 4: Obter o NFT ID
      const nftId = await contract.getNFTId(tokenId);
      console.log('NFT ID:', nftId.toString());
    }

    // Exemplo 5: Registrar um evento com mensagem
    console.log('Registrando evento...');
    const message = 'Leitura NFC em 23/06/2025';
    const txEvent = await contract.logEvent(tokenId, message, { gasLimit: 200000 });
    const receiptEvent = await txEvent.wait();
    console.log('Evento registrado! Tx Hash:', receiptEvent.transactionHash);

    // Exemplo 6: Consultar mensagem de evento
    const nftId = await contract.getNFTId(tokenId);
    const eventIndex = 0; // Primeiro evento
    const eventMessage = await contract.getEventMessage(nftId, eventIndex);
    console.log('Mensagem do evento:', eventMessage);

    // Exemplo 7: Consultar proprietário do NFT
    const owner = await contract.ownerOf(nftId);
    console.log('Proprietário do NFT:', owner);

  } catch (error) {
    console.error('Erro:', error.message);
  }
}

// Executar a função
interactWithContract();