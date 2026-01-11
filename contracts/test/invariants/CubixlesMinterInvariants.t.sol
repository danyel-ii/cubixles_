// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { StdInvariant } from "forge-std/StdInvariant.sol";
import { Test } from "forge-std/Test.sol";
import { CubixlesMinter } from "../../src/cubixles/CubixlesMinter.sol";
import { MockERC721Standard } from "../mocks/MockERC721s.sol";
import { MockERC20 } from "../mocks/MockERC20.sol";
import { Refs } from "../helpers/Refs.sol";

contract MintHandler is Test {
    CubixlesMinter public minter;
    MockERC721Standard public nft;
    MockERC20 public lessToken;
    uint256 public mintCount;
    uint256 public lastTokenId;
    uint256 public immutable mintPrice;
    bytes32 private constant METADATA_HASH = keccak256("metadata");
    bytes32 private constant IMAGE_PATH_HASH = keccak256("image-path");

    constructor(
        CubixlesMinter minter_,
        MockERC721Standard nft_,
        MockERC20 lessToken_,
        uint256 mintPrice_
    ) {
        minter = minter_;
        nft = nft_;
        lessToken = lessToken_;
        mintPrice = mintPrice_;
        vm.deal(address(this), 100 ether);
    }

    function mintOnce(uint8 countRaw) external {
        uint8 count = uint8((uint256(countRaw) % 6) + 1);
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](count);
        for (uint256 i = 0; i < count; i += 1) {
            uint256 mintedId = nft.mint(address(this));
            refs[i] = CubixlesMinter.NftRef({
                contractAddress: address(nft),
                tokenId: mintedId
            });
        }
        bytes32 salt = keccak256(abi.encodePacked("salt", mintCount, count));
        bytes32 refsHash = Refs.hashCanonical(refs);
        bytes32 commitment = minter.computeCommitment(address(this), salt, refsHash);
        minter.commitMint(commitment);
        (, uint256 commitBlock, , , , , ) = minter.mintCommitByMinter(address(this));
        uint256 revealBlock = commitBlock + minter.COMMIT_REVEAL_DELAY_BLOCKS();
        vm.roll(revealBlock + 1);
        uint256 expected = minter.previewPaletteIndex(address(this));
        string memory tokenUri = string.concat("ipfs://metadata/", vm.toString(expected));
        minter.commitMetadata(METADATA_HASH, IMAGE_PATH_HASH, expected);
        uint256 tokenId = minter.mint{ value: mintPrice }(
            salt,
            refs,
            expected,
            tokenUri,
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
        mintCount += 1;
        lastTokenId = tokenId;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

contract CubixlesMinterInvariants is StdInvariant, Test {
    CubixlesMinter private minter;
    MockERC721Standard private nft;
    MockERC20 private lessToken;
    MintHandler private handler;

    address private owner = makeAddr("owner");
    address private resaleSplitter = makeAddr("splitter");
    string private constant PALETTE_IMAGES_CID = "bafyimagescid";
    bytes32 private constant PALETTE_MANIFEST_HASH = keccak256("manifest");

    function _pricingConfig(
        uint256 fixedPrice,
        uint256 basePrice,
        uint256 stepPrice,
        bool linearEnabled
    ) internal pure returns (CubixlesMinter.PricingConfig memory) {
        return CubixlesMinter.PricingConfig({
            fixedMintPriceWei: fixedPrice,
            baseMintPriceWei: basePrice,
            baseMintPriceStepWei: stepPrice,
            linearPricingEnabled: linearEnabled
        });
    }

    function _paletteConfig(
        string memory imagesCid,
        bytes32 manifestHash
    ) internal pure returns (CubixlesMinter.PaletteConfig memory) {
        return CubixlesMinter.PaletteConfig({
            paletteImagesCID: imagesCid,
            paletteManifestHash: manifestHash
        });
    }

    function setUp() public {
        vm.startPrank(owner);
        lessToken = new MockERC20("LESS", "LESS");
        minter = new CubixlesMinter(
            resaleSplitter,
            address(lessToken),
            500,
            _pricingConfig(0, 0, 0, false),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
        );
        vm.stopPrank();
        nft = new MockERC721Standard("MockNFT", "MNFT");
        uint256 price = minter.currentMintPrice();
        handler = new MintHandler(minter, nft, lessToken, price);
        targetContract(address(handler));
    }

    function invariant_ownerBalanceMatchesMintCount() public {
        assertEq(resaleSplitter.balance, handler.mintCount() * handler.mintPrice());
    }

    function invariant_balanceMatchesMintCount() public {
        assertEq(minter.balanceOf(address(handler)), handler.mintCount());
    }

    function invariant_royaltyInfoReceiver() public {
        (address receiver, uint256 amount) = minter.royaltyInfo(1, 1 ether);
        assertEq(receiver, resaleSplitter);
        assertEq(amount, 0.05 ether);
    }
}
