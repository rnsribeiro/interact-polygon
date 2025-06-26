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

// Função para buscar informações de um tokenId específico
async function getTokenIdInfo(contract, tokenId, fromBlock = 23149844, toBlock = 'latest') {
  try {
    // Validar formato do tokenId (bytes32)
    if (!/^0x[a-fA-F0-9]{64}$/.test(tokenId)) {
      throw new Error('TokenId inválido: deve ser um valor bytes32 com 64 caracteres hexadecimais (com prefixo 0x).');
    }

    console.log(`Buscando informações para o tokenId: ${tokenId}`);

    // Verificar se o tokenId está registrado
    const isRegistered = await contract.isTokenRegistered(tokenId);
    if (!isRegistered) {
      console.log(`TokenId ${tokenId} não está registrado.`);
      return { tokenId, isRegistered: false };
    }

    // Obter o nftId associado
    const nftId = await contract.getNFTId(tokenId);
    console.log('NFT ID:', nftId.toString());

    // Obter o proprietário do NFT
    const owner = await contract.ownerOf(nftId);
    console.log('Proprietário do NFT:', owner);

    // Obter o número de eventos associados ao nftId
    const eventCount = await contract.eventCounts(nftId);
    console.log(`Número de eventos associados: ${eventCount.toString()}`);

    // Buscar eventos EventLogged para o tokenId
    console.log(`Buscando eventos EventLogged para tokenId ${tokenId} de ${fromBlock} até ${toBlock}...`);
    const filter = contract.filters.EventLogged(null, tokenId);
    const events = await contract.queryFilter(filter, fromBlock, toBlock);

    console.log(`Encontrados ${events.length} eventos EventLogged`);
    const eventDetails = [];
    
    // Consultar mensagens dos eventos
    for (let i = 0; i < eventCount; i++) {
      try {
        const message = await contract.getEventMessage(nftId, i);
        eventDetails.push({
          eventIndex: i,
          message,
          // Encontrar o evento correspondente para obter timestamp e outras informações
          eventData: events.find(e => e.args.eventIndex.toNumber() === i) || null
        });
      } catch (err) {
        console.warn(`Erro ao obter mensagem do evento ${i}: ${err.message}`);
      }
    }

    // Exibir detalhes dos eventos
    if (eventDetails.length === 0) {
      console.log('Nenhum evento encontrado para este tokenId.');
    } else {
      console.log('Eventos associados:');
      eventDetails.forEach(({ eventIndex, message, eventData }) => {
        console.log({
          eventIndex,
          message,
          timestamp: eventData ? new Date(Number(eventData.args.timestamp) * 1000).toISOString() : 'N/A',
          blockNumber: eventData ? eventData.blockNumber : 'N/A',
          transactionHash: eventData ? eventData.transactionHash : 'N/A'
        });
      });
    }

    return {
      tokenId,
      isRegistered: true,
      nftId: nftId.toString(),
      owner,
      eventCount: eventCount.toString(),
      events: eventDetails
    };
  } catch (error) {
    console.error(`Erro ao buscar informações do tokenId ${tokenId}:`, error.message);
    return { tokenId, isRegistered: false, error: error.message };
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

    // Exemplo: Buscar informações de um tokenId específico
    //               0x05684e98b97de6ecac92666b7e2de26dbe8e15430504d4a2c70965c09bd2a70b
    const tokenId = '0x05684e98b97de6ecac92666b7e2de26dbe8e15430504d4a2c70965c09bd2a70b'; // Substitua pelo tokenId desejado
                     
    const tokenInfo = await getTokenIdInfo(contract, tokenId);
    console.log('Informações do tokenId:', JSON.stringify(tokenInfo, null, 2));

  } catch (error) {
    console.error('Erro:', error.message);
    if (error.reason) console.error('Motivo:', error.reason);
    if (error.code) console.error('Código do erro:', error.code);
    if (error.response) console.error('Resposta:', JSON.stringify(error.response, null, 2));
  }
}

// Executar a função
interactWithContract();