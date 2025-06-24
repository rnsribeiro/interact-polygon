// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.2 <0.9.0;

// Contrato para gerenciar NFTs Uniq ID com eventos e mensagens, sem dependências externas
contract UniqIDNFT {
    // Endereço do proprietário (backend)
    address public owner;

    // Contador para gerar IDs de NFTs
    uint256 private _tokenIdCounter;

    // Mapeamento de tokenId (bytes32) para ID do NFT (uint256)
    mapping(bytes32 => uint256) public tokenIdToNFT;

    // Mapeamento para contar eventos associados a cada NFT
    mapping(uint256 => uint256) public eventCounts;

    // Mapeamento para armazenar mensagens de eventos (indexadas por NFT ID e índice do evento)
    mapping(uint256 => mapping(uint256 => string)) private eventMessages;

    // Mapeamento para rastrear proprietários dos NFTs
    mapping(uint256 => address) private _owners;

    // Mapeamento para aprovações (opcional, para compatibilidade básica com ERC-721)
    mapping(uint256 => address) private _tokenApprovals;

    // Evento ERC-721: Transfer (emitido ao criar ou transferir NFTs)
    event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId);

    // Evento emitido ao criar um novo NFT
    event NFTRegistered(bytes32 indexed tokenId, uint256 indexed nftId, uint256 timestamp);

    // Evento emitido ao registrar um novo evento para um NFT
    event EventLogged(uint256 indexed nftId, bytes32 indexed tokenId, uint256 eventIndex, string message, uint256 timestamp);

    // Modificador para restringir acesso ao proprietário
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    // Construtor: define o proprietário e inicializa o contador
    constructor() {
        owner = msg.sender;
        _tokenIdCounter = 1; // Começa em 1 para evitar ID 0
    }

    // Função para criar um NFT associado a um tokenId
    function registerNFT(bytes32 tokenId) external onlyOwner {
        require(tokenIdToNFT[tokenId] == 0, "Token ID already registered");

        uint256 nftId = _tokenIdCounter;
        _tokenIdCounter++;

        // Associa o tokenId ao NFT
        tokenIdToNFT[tokenId] = nftId;

        // Atribui o NFT ao proprietário (backend)
        _owners[nftId] = msg.sender;

        // Emite eventos
        emit Transfer(address(0), msg.sender, nftId);
        emit NFTRegistered(tokenId, nftId, block.timestamp);
    }

    // Função para registrar um evento com mensagem para um NFT
    function logEvent(bytes32 tokenId, string calldata message) external onlyOwner {
        uint256 nftId = tokenIdToNFT[tokenId];
        require(nftId != 0, "NFT does not exist for this tokenId");

        uint256 eventIndex = eventCounts[nftId];
        eventCounts[nftId] = eventIndex + 1;

        // Armazena a mensagem do evento
        eventMessages[nftId][eventIndex] = message;

        emit EventLogged(nftId, tokenId, eventIndex, message, block.timestamp);
    }

    // Função para verificar se um tokenId está registrado como NFT
    function isTokenRegistered(bytes32 tokenId) external view returns (bool) {
        return tokenIdToNFT[tokenId] != 0;
    }

    // Função para consultar a mensagem de um evento específico
    function getEventMessage(uint256 nftId, uint256 eventIndex) external view returns (string memory) {
        require(eventIndex < eventCounts[nftId], "Event index does not exist");
        require(_owners[nftId] == msg.sender || owner == msg.sender, "Not authorized");
        return eventMessages[nftId][eventIndex];
    }

    // Função para obter o NFT ID associado a um tokenId
    function getNFTId(bytes32 tokenId) external view returns (uint256) {
        uint256 nftId = tokenIdToNFT[tokenId];
        require(nftId != 0, "Token ID not registered");
        return nftId;
    }

    // Função para consultar o proprietário de um NFT (compatibilidade ERC-721)
    function ownerOf(uint256 nftId) external view returns (address) {
        address nftOwner = _owners[nftId];
        require(nftOwner != address(0), "NFT does not exist");
        return nftOwner;
    }

    // Função para transferir propriedade do contrato (opcional, para manutenção)
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }
}