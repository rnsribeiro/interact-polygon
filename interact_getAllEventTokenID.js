require('dotenv').config();
const { ethers } = require('ethers');

// Importar o ABI do contrato
const CONTRACT_ABI = require('./abis/UniqIDNFT.json');

// Configurações
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ALCHEMY_RPC_URL = `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const PUBLIC_RPC_URL = 'https://rpc-amoy.polygon.technology/';
const POLYGON_AMOY_CHAIN_ID = 80002;

// Função para inicializar o provedor
async function getProvider() {
  try {
    console.log('Inicializando JSON-RPC provider para Polygon Amoy (Alchemy)...');
    console.log('Testando Alchemy RPC URL:', ALCHEMY_RPC_URL.replace(ALCHEMY_API_KEY, '****'));
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    // Verificar conexão e chain ID
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId); // Converter BigInt para número
    console.log('Rede detectada:', network.name, 'Chain ID:', chainId);
    if (chainId !== POLYGON_AMOY_CHAIN_ID) {
      throw new Error(`Chain ID inválido. Esperado: ${POLYGON_AMOY_CHAIN_ID}, Recebido: ${chainId}`);
    }
    
    console.log('JSON-RPC provider (Alchemy) conectado com sucesso');
    return provider;
  } catch (error) {
    console.error('Erro ao conectar JSON-RPC provider (Alchemy):', error.message);
    console.log('Tentando fallback com provedor público Polygon Amoy...');
    
    try {
      console.log('Testando Public RPC URL:', PUBLIC_RPC_URL);
      const fallbackProvider = new ethers.JsonRpcProvider(PUBLIC_RPC_URL);
      const network = await fallbackProvider.getNetwork();
      const chainId = Number(network.chainId); // Converter BigInt para número
      console.log('Rede detectada (pública):', network.name, 'Chain ID:', chainId);
      if (chainId !== POLYGON_AMOY_CHAIN_ID) {
        throw new Error(`Chain ID inválido (público). Esperado: ${POLYGON_AMOY_CHAIN_ID}, Recebido: ${chainId}`);
      }
      console.log('Provedor público RPC conectado com sucesso');
      return fallbackProvider;
    } catch (err) {
      console.error('Erro ao conectar provedor público:', err.message);
      throw new Error('Falha ao conectar qualquer provedor');
    }
  }
}

// Função para obter todos os eventos relacionados a um tokenId
async function getAllEventsForTokenId(contract, provider, tokenId) {
  try {
    console.log(`Buscando eventos para tokenId: ${tokenId}`);
    
    // Criar interface do contrato para decodificar eventos
    const contractInterface = new ethers.Interface(CONTRACT_ABI);
    
    // Obter o block atual para limitar a busca
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = 0; // Buscar desde o início da blockchain (pode ajustar para otimizar)

    // Definir os tópicos para os eventos EventLogged e NFTRegistered
    const eventLoggedTopic = ethers.id('EventLogged(uint256,bytes32,uint256,string,uint256)');
    const nftRegisteredTopic = ethers.id('NFTRegistered(bytes32,uint256,uint256)');
    
    // Filtrar logs para EventLogged com o tokenId como segundo parâmetro indexado (topics[2])
    const eventLoggedFilter = {
      address: CONTRACT_ADDRESS,
      fromBlock,
      toBlock: currentBlock,
      topics: [
        eventLoggedTopic,
        null, // nftId (primeiro parâmetro indexado, não filtrado)
        ethers.zeroPadValue(tokenId, 32), // tokenId (segundo parâmetro indexado)
      ],
    };

    // Filtrar logs para NFTRegistered com o tokenId como primeiro parâmetro indexado (topics[1])
    const nftRegisteredFilter = {
      address: CONTRACT_ADDRESS,
      fromBlock,
      toBlock: currentBlock,
      topics: [
        nftRegisteredTopic,
        ethers.zeroPadValue(tokenId, 32), // tokenId (primeiro parâmetro indexado)
      ],
    };

    // Obter logs para ambos os eventos
    const eventLoggedLogs = await provider.getLogs(eventLoggedFilter);
    const nftRegisteredLogs = await provider.getLogs(nftRegisteredFilter);

    // Combinar e ordenar logs por número de bloco
    const allLogs = [...eventLoggedLogs, ...nftRegisteredLogs].sort((a, b) => a.blockNumber - b.blockNumber);

    if (allLogs.length === 0) {
      console.log('Nenhum evento encontrado para o tokenId:', tokenId);
      return [];
    }

    // Processar os logs
    const events = allLogs.map(log => {
      try {
        // Decodificar o log usando a interface do contrato
        const parsedLog = contractInterface.parseLog(log);
        
        // Estruturar os dados do evento
        const eventData = {
          eventName: parsedLog.name,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        };

        if (parsedLog.name === 'EventLogged') {
          eventData.nftId = parsedLog.args.nftId.toString();
          eventData.tokenId = parsedLog.args.tokenId;
          eventData.eventIndex = parsedLog.args.eventIndex.toString();
          eventData.message = String(parsedLog.args.message); // Converter mensagem para string
          eventData.timestamp = parsedLog.args.timestamp.toString();
        } else if (parsedLog.name === 'NFTRegistered') {
          eventData.tokenId = parsedLog.args.tokenId;
          eventData.nftId = parsedLog.args.nftId.toString();
          eventData.timestamp = parsedLog.args.timestamp.toString();
        }

        return eventData;
      } catch (err) {
        console.error(`Erro ao decodificar log: ${log.transactionHash}`, err.message);
        return null;
      }
    }).filter(event => event !== null);

    // Exibir os eventos
    console.log(`Eventos encontrados para tokenId ${tokenId}:`);
    events.forEach(event => {
      console.log(`- Evento: ${event.eventName}`);
      console.log(`  Block: ${event.blockNumber}`);
      console.log(`  Tx Hash: ${event.transactionHash}`);
      console.log(`  NFT ID: ${event.nftId}`);
      console.log(`  TokenId: ${event.tokenId}`);
      if (event.message) {
        console.log(`  Mensagem: ${event.message}`);
      }
      console.log(`  Timestamp: ${event.timestamp}`);
      console.log('---');
    });

    return events;
  } catch (error) {
    console.error('Erro ao buscar eventos:', error.message);
    return [];
  }
}

// Função principal para interagir com o contrato
async function interactWithContract() {
  try {
    // Obter provedor
    const provider = await getProvider();
    console.log('Provedor conectado com sucesso');

    // Criar carteira a partir da chave privada usando Ethers.js
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log('Carteira criada:', wallet.address);

    // Verificar saldo da carteira
    const balance = await provider.getBalance(wallet.address);
    console.log('Saldo da carteira:', ethers.formatEther(balance), 'POL');

    // Instanciar o contrato usando Ethers.js com o provedor
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    console.log('Contrato instanciado em:', CONTRACT_ADDRESS);

    // Verificar dono do contrato
    const contractOwner = await contract.owner();
    console.log('Dono do contrato:', contractOwner);

    // Exemplo 1: Calcular tokenId (HASH(EPC || TID))
    const epc = '0x3039ABCDEF1234567809'; // Exemplo do documento
    const tid = '0xE2003412012345678900'; // Exemplo do documento
    const tokenId = ethers.keccak256(ethers.concat([epc, tid]));
    console.log('TokenId calculado:', tokenId);

    // Novo: Obter todos os eventos para o tokenId
    await getAllEventsForTokenId(contract, provider, tokenId);

    // Exemplo 2: Verificar se tokenId está registrado
    const isRegistered = await contract.isTokenRegistered(tokenId);
    console.log('TokenId registrado?', isRegistered);

    if (!isRegistered) {
      // Exemplo 3: Registrar um novo NFT
      console.log('Registrando NFT...');
      const tx = await contract.registerNFT(tokenId, { gasLimit: 200000 });
      console.log('Tx enviada:', tx.hash);
      const receipt = await tx.wait();
      console.log('Receipt:', JSON.stringify(receipt, null, 2)); // Debug
      console.log('NFT registrado! Tx Hash:', receipt.hash || tx.hash);
      
      // Exemplo 4: Obter o NFT ID
      const nftId = await contract.getNFTId(tokenId);
      console.log('NFT ID:', nftId.toString());
    }

    // Exemplo 5: Registrar um evento com mensagem
    console.log('Registrando evento...');
    const message = 'Leitura NFC em 23/06/2025';
    const txEvent = await contract.logEvent(tokenId, message, { gasLimit: 200000 });
    console.log('Tx evento enviada:', txEvent.hash);
    const receiptEvent = await txEvent.wait();
    console.log('Receipt evento:', JSON.stringify(receiptEvent, null, 2)); // Debug
    console.log('Evento registrado! Tx Hash:', receiptEvent.hash || txEvent.hash);

    // Exemplo 6: Consultar mensagem de evento
    const nftId = await contract.getNFTId(tokenId);
    const eventIndex = 0; // Primeiro evento
    const eventMessage = await contract.getEventMessage(nftId, eventIndex);
    console.log('Mensagem do evento:', eventMessage);

    // Exemplo 7: Consultar proprietário do NFT
    const owner = await contract.ownerOf(nftId);
    console.log('Proprietário do NFT:', owner);

    // Exemplo 8: Escutar eventos em tempo real (opcional)
    console.log('Escutando eventos EventLogged...');
    contract.on('EventLogged', (nftId, tokenId, eventIndex, message, timestamp) => {
      console.log(`Evento detectado: NFT ${nftId}, Mensagem: ${message}, Timestamp: ${timestamp}`);
    });

  } catch (error) {
    console.error('Erro:', error.message);
    if (error.reason) console.error('Motivo:', error.reason);
    if (error.code) console.error('Código do erro:', error.code);
    if (error.response) console.error('Resposta:', JSON.stringify(error.response, null, 2));
  }
}

// Executar a função
interactWithContract();