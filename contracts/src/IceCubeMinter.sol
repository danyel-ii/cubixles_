// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract IceCubeMinter is ERC721URIStorage, ERC2981, Ownable {
    struct NftRef {
        address contractAddress;
        uint256 tokenId;
    }

    uint96 public constant MINT_ROYALTY_BPS = 1000; // 10%
    uint96 public constant RESALE_ROYALTY_BPS_DEFAULT = 500; // 5%

    uint256 private _nextTokenId = 1;

    address public creator;
    address public lessTreasury;
    address public pnkstrTreasury;
    address public poolTreasury;

    event Minted(address indexed minter, uint256 indexed tokenId, string tokenURI);
    event MintRoyaltySplit(
        uint256 amount,
        uint256 creatorShare,
        uint256 lessShare,
        uint256 pnkstrShare,
        uint256 poolShare
    );
    event RoyaltyReceiversUpdated(
        address creator,
        address lessTreasury,
        address pnkstrTreasury,
        address poolTreasury
    );

    constructor(
        address creator_,
        address lessTreasury_,
        address pnkstrTreasury_,
        address poolTreasury_,
        uint96 resaleRoyaltyBps
    ) ERC721("IceCube", "ICECUBE") Ownable(msg.sender) {
        require(creator_ != address(0), "Creator required");
        require(lessTreasury_ != address(0), "Less treasury required");
        require(pnkstrTreasury_ != address(0), "Pnkstr treasury required");
        require(poolTreasury_ != address(0), "Pool treasury required");
        require(resaleRoyaltyBps <= 1000, "Royalty too high");

        creator = creator_;
        lessTreasury = lessTreasury_;
        pnkstrTreasury = pnkstrTreasury_;
        poolTreasury = poolTreasury_;

        _setDefaultRoyalty(poolTreasury_, resaleRoyaltyBps);
    }

    function mint(
        string calldata tokenURI,
        NftRef[3] calldata refs
    ) external payable returns (uint256 tokenId) {
        _validateOwnership(msg.sender, refs);

        tokenId = _nextTokenId;
        _nextTokenId += 1;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI);

        _splitMintRoyalty(msg.value);

        emit Minted(msg.sender, tokenId, tokenURI);
    }

    function setRoyaltyReceivers(
        address creator_,
        address lessTreasury_,
        address pnkstrTreasury_,
        address poolTreasury_
    ) external onlyOwner {
        require(creator_ != address(0), "Creator required");
        require(lessTreasury_ != address(0), "Less treasury required");
        require(pnkstrTreasury_ != address(0), "Pnkstr treasury required");
        require(poolTreasury_ != address(0), "Pool treasury required");

        creator = creator_;
        lessTreasury = lessTreasury_;
        pnkstrTreasury = pnkstrTreasury_;
        poolTreasury = poolTreasury_;

        emit RoyaltyReceiversUpdated(creator_, lessTreasury_, pnkstrTreasury_, poolTreasury_);
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

    function _validateOwnership(address owner, NftRef[3] calldata refs) internal view {
        for (uint256 i = 0; i < 3; i += 1) {
            address nftOwner = IERC721(refs[i].contractAddress).ownerOf(refs[i].tokenId);
            require(nftOwner == owner, "Not owner of referenced NFT");
        }
    }

    function _splitMintRoyalty(uint256 amount) internal {
        if (amount == 0) {
            return;
        }

        uint256 creatorShare = (amount * 20) / 100;
        uint256 lessShare = (amount * 40) / 100;
        uint256 pnkstrShare = (amount * 20) / 100;
        uint256 poolShare = amount - creatorShare - lessShare - pnkstrShare;

        _transferEth(creator, creatorShare);
        _transferEth(lessTreasury, lessShare);
        _transferEth(pnkstrTreasury, pnkstrShare);
        _transferEth(poolTreasury, poolShare);

        emit MintRoyaltySplit(amount, creatorShare, lessShare, pnkstrShare, poolShare);
    }

    function _transferEth(address recipient, uint256 amount) internal {
        if (amount == 0) {
            return;
        }
        (bool success, ) = recipient.call{ value: amount }("");
        require(success, "Transfer failed");
    }
}
