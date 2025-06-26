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

// Função para buscar todos os eventos históricos do contrato em intervalos
async function getAllHistoricalEvents(contract, provider, fromBlock = 23149844, toBlock = 'latest') {
  try {
    // Obter o bloco mais recente se toBlock for 'latest'
    const latestBlock = toBlock === 'latest' ? await provider.getBlockNumber() : toBlock;
    console.log(`Buscando todos os eventos históricos do contrato de ${fromBlock} até ${latestBlock}...`);

    // Definir intervalo máximo de blocos (500, conforme limite da Alchemy)
    const blockRange = 500;
    let currentFrom = fromBlock;
    let registeredNFTs = [];
    let loggedEvents = [];

    // Iterar em intervalos de 500 blocos
    while (currentFrom <= latestBlock) {
      const currentTo = Math.min(currentFrom + blockRange - 1, latestBlock);
      console.log(`Buscando eventos no intervalo de ${currentFrom} até ${currentTo}...`);

      // Buscar eventos NFTRegistered
      try {
        const nftRegisteredFilter = contract.filters.NFTRegistered();
        const nftEvents = await contract.queryFilter(nftRegisteredFilter, currentFrom, currentTo);
        registeredNFTs = registeredNFTs.concat(nftEvents.map(event => ({
          tokenId: event.args.tokenId,
          nftId: event.args.nftId.toString(),
          timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString(),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        })));
      } catch (err) {
        console.warn(`Erro ao buscar eventos NFTRegistered no intervalo ${currentFrom}-${currentTo}: ${err.message}`);
      }

      // Buscar eventos EventLogged
      try {
        const eventLoggedFilter = contract.filters.EventLogged();
        const logEvents = await contract.queryFilter(eventLoggedFilter, currentFrom, currentTo);
        loggedEvents = loggedEvents.concat(logEvents.map(event => ({
          nftId: event.args.nftId.toString(),
          tokenId: event.args.tokenId,
          eventIndex: event.args.eventIndex.toString(),
          message: event.args.message,
          timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString(),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        })));
      } catch (err) {
        console.warn(`Erro ao buscar eventos EventLogged no intervalo ${currentFrom}-${currentTo}: ${err.message}`);
      }

      currentFrom += blockRange;
    }

    // Exibir eventos NFTRegistered
    console.log(`Encontrados ${registeredNFTs.length} eventos NFTRegistered`);
    if (registeredNFTs.length === 0) {
      console.log('Nenhum evento NFTRegistered encontrado.');
    } else {
      console.log('NFTs registrados:');
      registeredNFTs.forEach(({ tokenId, nftId, timestamp, blockNumber, transactionHash }) => {
        console.log({
          tokenId,
          nftId,
          timestamp,
          blockNumber,
          transactionHash
        });
      });
    }

    // Exibir eventos EventLogged
    console.log(`Encontrados ${loggedEvents.length} eventos EventLogged`);
    if (loggedEvents.length === 0) {
      console.log('Nenhum evento EventLogged encontrado.');
    } else {
      console.log('Eventos logados:');
      loggedEvents.forEach(({ nftId, tokenId, eventIndex, message, timestamp, blockNumber, transactionHash }) => {
        console.log({
          nftId,
          tokenId,
          eventIndex,
          message,
          timestamp,
          blockNumber,
          transactionHash
        });
      });
    }

    // Verificar mensagens armazenadas no estado para cada NFT registrado
    const eventMessages = [];
    for (const { nftId } of registeredNFTs) {
      try {
        const eventCount = await contract.eventCounts(nftId);
        for (let i = 0; i < eventCount; i++) {
          try {
            const message = await contract.getEventMessage(nftId, i);
            const eventData = loggedEvents.find(e => e.nftId === nftId && e.eventIndex === i.toString()) || null;
            eventMessages.push({
              nftId,
              eventIndex: i,
              message,
              timestamp: eventData ? eventData.timestamp : 'N/A (Evento não encontrado nos logs)',
              blockNumber: eventData ? eventData.blockNumber : 'N/A',
              transactionHash: eventData ? eventData.transactionHash : 'N/A'
            });
          } catch (err) {
            console.warn(`Erro ao obter mensagem do evento ${i} para nftId ${nftId}: ${err.message}`);
          }
        }
      } catch (err) {
        console.warn(`Erro ao obter eventCounts para nftId ${nftId}: ${err.message}`);
      }
    }

    // Exibir mensagens armazenadas
    if (eventMessages.length === 0) {
      console.log('Nenhuma mensagem de evento armazenada encontrada.');
    } else {
      console.log('Mensagens de eventos armazenadas:');
      eventMessages.forEach(({ nftId, eventIndex, message, timestamp, blockNumber, transactionHash }) => {
        console.log({
          nftId,
          eventIndex,
          message,
          timestamp,
          blockNumber,
          transactionHash
        });
      });
    }

    return {
      registeredNFTs,
      loggedEvents,
      eventMessages
    };
  } catch (error) {
    console.error('Erro ao buscar eventos históricos:', error.message);
    return { registeredNFTs: [], loggedEvents: [], eventMessages: [], error: error.message };
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

    // Buscar todos os eventos históricos
    const historicalEvents = await getAllHistoricalEvents(contract, provider, 23149844);
    console.log('Eventos históricos:', JSON.stringify(historicalEvents, null, 2));

  } catch (error) {
    console.error('Erro:', error.message);
    if (error.reason) console.error('Motivo:', error.reason);
    if (error.code) console.error('Código do erro:', error.code);
    if (error.response) console.error('Resposta:', JSON.stringify(error.response, null, 2));
  }
}

// Executar a função
interactWithContract();