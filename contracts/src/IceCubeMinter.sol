// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract IceCubeMinter is ERC721URIStorage, ERC2981, Ownable, ReentrancyGuard {
    struct NftRef {
        address contractAddress;
        uint256 tokenId;
    }

    uint96 public constant MINT_ROYALTY_BPS = 1000; // 10%
    uint96 public constant MINT_CREATOR_BPS = 2000; // 20% of mint royalty
    uint96 public constant MINT_LESS_BPS = 2000; // 20% of mint royalty
    uint96 public constant MINT_COLLECTION_BPS = 6000; // 60% of mint royalty
    uint96 public constant RESALE_ROYALTY_BPS_DEFAULT = 500; // 5%
    uint256 public constant MINT_PRICE = 0.0027 ether;

    uint256 private _nextTokenId = 1;

    address public creator;
    address public lessTreasury;
    address public resaleSplitter;

    event Minted(address indexed minter, uint256 indexed tokenId, string tokenURI);
    event MintRoyaltySplit(
        uint256 royaltyTotal,
        uint256 creatorShare,
        uint256 lessShare,
        uint256 collectionShare,
        uint256 supportedCount
    );
    event RoyaltyReceiversUpdated(address creator, address lessTreasury, address resaleSplitter);

    constructor(
        address creator_,
        address lessTreasury_,
        address resaleSplitter_,
        uint96 resaleRoyaltyBps
    ) ERC721("IceCube", "ICECUBE") Ownable(msg.sender) {
        require(creator_ != address(0), "Creator required");
        require(lessTreasury_ != address(0), "Less treasury required");
        require(resaleSplitter_ != address(0), "Resale splitter required");
        require(resaleRoyaltyBps <= 1000, "Royalty too high");

        creator = creator_;
        lessTreasury = lessTreasury_;
        resaleSplitter = resaleSplitter_;

        _setDefaultRoyalty(resaleSplitter_, resaleRoyaltyBps);
    }

    function mint(
        string calldata tokenURI,
        NftRef[] calldata refs
    ) external payable nonReentrant returns (uint256 tokenId) {
        // Revert if refs length is outside 1..6 to prevent ambiguous split math.
        require(refs.length >= 1 && refs.length <= 6, "Invalid reference count");
        uint256 perRefRoyalty = (MINT_PRICE * MINT_ROYALTY_BPS) / 10000 / refs.length;
        address[] memory royaltyReceivers = new address[](refs.length);
        uint256 supportedCount = 0;

        for (uint256 i = 0; i < refs.length; i += 1) {
            address nftOwner = IERC721(refs[i].contractAddress).ownerOf(refs[i].tokenId);
            require(nftOwner == msg.sender, "Not owner of referenced NFT");
            try IERC2981(refs[i].contractAddress).royaltyInfo(refs[i].tokenId, MINT_PRICE) returns (
                address receiver,
                uint256
            ) {
                if (receiver != address(0)) {
                    royaltyReceivers[supportedCount] = receiver;
                    supportedCount += 1;
                }
            } catch {}
        }

        uint256 royaltyTotal = perRefRoyalty * supportedCount;
        uint256 requiredValue = MINT_PRICE + royaltyTotal;
        // Revert if sender does not cover mint price + royalty on top.
        require(msg.value >= requiredValue, "Insufficient mint payment");

        tokenId = _nextTokenId;
        _nextTokenId += 1;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI);

        _splitMintRoyalty(royaltyTotal, perRefRoyalty, supportedCount, royaltyReceivers);

        emit Minted(msg.sender, tokenId, tokenURI);

        if (msg.value > requiredValue) {
            _transferEth(msg.sender, msg.value - requiredValue);
        }
    }

    function setRoyaltyReceivers(
        address creator_,
        address lessTreasury_,
        address resaleSplitter_
    ) external onlyOwner {
        require(creator_ != address(0), "Creator required");
        require(lessTreasury_ != address(0), "Less treasury required");
        require(resaleSplitter_ != address(0), "Resale splitter required");

        creator = creator_;
        lessTreasury = lessTreasury_;
        resaleSplitter = resaleSplitter_;

        emit RoyaltyReceiversUpdated(creator_, lessTreasury_, resaleSplitter_);
    }

    function setResaleRoyalty(uint96 bps, address receiver) external onlyOwner {
        require(receiver != address(0), "Receiver required");
        require(bps <= 1000, "Royalty too high");
        _setDefaultRoyalty(receiver, bps);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _splitMintRoyalty(
        uint256 royaltyTotal,
        uint256 perRefRoyalty,
        uint256 supportedCount,
        address[] memory receivers
    ) internal {
        if (royaltyTotal == 0) {
            return;
        }

        uint256 creatorShare = (royaltyTotal * MINT_CREATOR_BPS) / 10000;
        uint256 lessShare = (royaltyTotal * MINT_LESS_BPS) / 10000;
        uint256 collectionShare = (perRefRoyalty * MINT_COLLECTION_BPS) / 10000;

        _transferEth(creator, creatorShare);
        _transferEth(lessTreasury, lessShare);
        for (uint256 i = 0; i < supportedCount; i += 1) {
            _transferEth(receivers[i], collectionShare);
        }

        uint256 distributed =
            creatorShare + lessShare + (collectionShare * supportedCount);
        if (royaltyTotal > distributed) {
            _transferEth(creator, royaltyTotal - distributed);
        }

        emit MintRoyaltySplit(
            royaltyTotal,
            creatorShare,
            lessShare,
            collectionShare * supportedCount,
            supportedCount
        );
    }

    function _transferEth(address recipient, uint256 amount) internal {
        if (amount == 0) {
            return;
        }
        (bool success, ) = recipient.call{ value: amount }("");
        require(success, "Transfer failed");
    }
}
