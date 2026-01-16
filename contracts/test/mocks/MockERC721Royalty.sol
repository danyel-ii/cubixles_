// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";

contract MockERC721Royalty is ERC721, ERC2981 {
    uint256 private _nextId = 1;

    constructor(
        string memory name_,
        string memory symbol_,
        address receiver_,
        uint96 bps_
    ) ERC721(name_, symbol_) {
        _setDefaultRoyalty(receiver_, bps_);
    }

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextId;
        _nextId += 1;
        _mint(to, tokenId);
    }

    function setRoyalty(address receiver_, uint96 bps_) external {
        _setDefaultRoyalty(receiver_, bps_);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

contract MockERC721RoyaltyRevertsOwner is ERC721, ERC2981 {
    constructor(
        string memory name_,
        string memory symbol_,
        address receiver_,
        uint96 bps_
    ) ERC721(name_, symbol_) {
        _setDefaultRoyalty(receiver_, bps_);
    }

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }

    function ownerOf(uint256) public pure override returns (address) {
        revert("ownerOf reverted");
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

contract MockERC721RoyaltyRevertsRoyalty is ERC721, ERC2981 {
    uint256 private _nextId = 1;

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextId;
        _nextId += 1;
        _mint(to, tokenId);
    }

    function royaltyInfo(uint256, uint256) public pure override returns (address, uint256) {
        revert("royaltyInfo reverted");
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

contract MockERC721RoyaltyZeroReceiver is ERC721, ERC2981 {
    uint256 private _nextId = 1;

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextId;
        _nextId += 1;
        _mint(to, tokenId);
    }

    function royaltyInfo(uint256, uint256) public pure override returns (address, uint256) {
        return (address(0), 0);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
