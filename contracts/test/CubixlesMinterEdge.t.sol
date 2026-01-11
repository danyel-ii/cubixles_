// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { CubixlesMinter } from "../src/cubixles/CubixlesMinter.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import {
    MockERC721Standard,
    MockERC721RevertingOwnerOf,
    MockERC721ReturnsWrongOwner
} from "./mocks/MockERC721s.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import {
    ReceiverRevertsOnReceive,
    ReceiverConsumesGasOnReceive,
    MaliciousReceiverReenter
} from "./mocks/Receivers.sol";
import { Refs } from "./helpers/Refs.sol";

contract RefundRevertsOnReceive {
    using Strings for uint256;

    CubixlesMinter public minter;
    CubixlesMinter.NftRef[] public refs;
    bytes32 public constant DEFAULT_SALT = keccak256("refund");
    string private constant TOKEN_URI_PREFIX = "ipfs://metadata/";
    bytes32 private constant METADATA_HASH = keccak256("metadata");
    bytes32 private constant IMAGE_PATH_HASH = keccak256("image-path");

    constructor(CubixlesMinter minter_) {
        minter = minter_;
    }

    receive() external payable {
        revert("Refund rejected");
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function configure(CubixlesMinter.NftRef[] calldata refs_) external {
        delete refs;
        for (uint256 i = 0; i < refs_.length; i += 1) {
            refs.push(refs_[i]);
        }
    }

    function mintWithOverpay() external payable {
        uint256 expected = minter.previewPaletteIndex(address(this));
        string memory tokenUri = string.concat(TOKEN_URI_PREFIX, expected.toString());
        minter.commitMetadata(METADATA_HASH, IMAGE_PATH_HASH, expected);
        minter.mint{ value: msg.value }(
            DEFAULT_SALT,
            refs,
            expected,
            tokenUri,
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }
}

contract CubixlesMinterEdgeTest is Test {
    CubixlesMinter private minter;
    MockERC721Standard private nft;
    MockERC20 private lessToken;
    address private owner = makeAddr("owner");
    address private resaleSplitter = makeAddr("splitter");
    bytes32 private constant DEFAULT_SALT = keccak256("salt");
    uint256 private constant DEFAULT_RANDOMNESS = 123_456;
    string private constant PALETTE_IMAGES_CID = "bafyimagescid";
    bytes32 private constant PALETTE_MANIFEST_HASH = keccak256("manifest");
    string private constant TOKEN_URI_PREFIX = "ipfs://metadata/";
    bytes32 private constant METADATA_HASH = keccak256("metadata");
    bytes32 private constant IMAGE_PATH_HASH = keccak256("image-path");

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

    function _commitMint(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs
    ) internal {
        bytes32 refsHash = Refs.hashCanonical(refs);
        bytes32 commitment = minter.computeCommitment(minterAddr, salt, refsHash);
        vm.prank(minterAddr);
        minter.commitMint(commitment);
    }

    function _advanceToReveal(address minterAddr) internal {
        (, uint256 commitBlock, , , , , ) = minter.mintCommitByMinter(minterAddr);
        uint256 revealBlock = commitBlock + minter.COMMIT_REVEAL_DELAY_BLOCKS();
        vm.roll(revealBlock + 1);
    }

    function _commitAndFulfill(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs,
        uint256 randomness
    ) internal {
        randomness;
        _commitMint(minterAddr, salt, refs);
        _advanceToReveal(minterAddr);
    }

    function _buildTokenURI(uint256 paletteIndex) internal view returns (string memory) {
        return string.concat(TOKEN_URI_PREFIX, vm.toString(paletteIndex));
    }

    function _commitMetadata(address minterAddr) internal {
        uint256 expected = minter.previewPaletteIndex(minterAddr);
        vm.prank(minterAddr);
        minter.commitMetadata(METADATA_HASH, IMAGE_PATH_HASH, expected);
    }

    function _mintWithExpected(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs,
        uint256 value
    ) internal returns (uint256 tokenId) {
        uint256 expected = minter.previewPaletteIndex(minterAddr);
        string memory tokenUri = _buildTokenURI(expected);
        _commitMetadata(minterAddr);
        vm.prank(minterAddr);
        tokenId = minter.mint{ value: value }(
            salt,
            refs,
            expected,
            tokenUri,
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
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
    }

    function testMintRevertsWhenOwnerReceiveFails() public {
        ReceiverRevertsOnReceive receiver = new ReceiverRevertsOnReceive();
        vm.prank(owner);
        minter = new CubixlesMinter(
            address(receiver),
            address(lessToken),
            500,
            _pricingConfig(0, 0, 0, false),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
        );

        address minterAddr = makeAddr("minter");
        uint256 tokenId = nft.mint(minterAddr);
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](1);
        refs[0] = CubixlesMinter.NftRef({ contractAddress: address(nft), tokenId: tokenId });

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 expected = minter.previewPaletteIndex(minterAddr);
        _commitMetadata(minterAddr);
        vm.prank(minterAddr);
        vm.expectRevert();
        minter.mint{ value: price }(
            DEFAULT_SALT,
            refs,
            expected,
            _buildTokenURI(expected),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testMintRevertsWhenRefundFails() public {
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](1);
        RefundRevertsOnReceive refundReverter = new RefundRevertsOnReceive(minter);
        uint256 tokenId = nft.mint(address(refundReverter));
        refs[0] = CubixlesMinter.NftRef({ contractAddress: address(nft), tokenId: tokenId });
        refundReverter.configure(refs);
        uint256 price = minter.currentMintPrice();
        vm.deal(address(refundReverter), price + 1 wei);

        _commitAndFulfill(address(refundReverter), refundReverter.DEFAULT_SALT(), refs, DEFAULT_RANDOMNESS);
        vm.expectRevert();
        refundReverter.mintWithOverpay{ value: price + 1 wei }();
    }

    function testOwnerOfRevertBubbles() public {
        MockERC721RevertingOwnerOf badNft = new MockERC721RevertingOwnerOf();
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](1);
        refs[0] = CubixlesMinter.NftRef({ contractAddress: address(badNft), tokenId: 1 });

        _commitMint(address(this), DEFAULT_SALT, refs);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesMinter.RefOwnershipCheckFailed.selector,
                address(badNft),
                1
            )
        );
        minter.mint(
            DEFAULT_SALT,
            refs,
            0,
            _buildTokenURI(0),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testWrongOwnerReverts() public {
        address wrongOwner = makeAddr("wrongOwner");
        MockERC721ReturnsWrongOwner badNft = new MockERC721ReturnsWrongOwner(wrongOwner);
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](1);
        refs[0] = CubixlesMinter.NftRef({ contractAddress: address(badNft), tokenId: 1 });

        _commitMint(address(this), DEFAULT_SALT, refs);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesMinter.RefNotOwned.selector,
                address(badNft),
                1,
                address(this),
                wrongOwner
            )
        );
        minter.mint(
            DEFAULT_SALT,
            refs,
            0,
            _buildTokenURI(0),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testTokenIdDiffersForDifferentSalts() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenIdA = nft.mint(minterAddr);
        uint256 tokenIdB = nft.mint(minterAddr);
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](1);
        refs[0] = CubixlesMinter.NftRef({ contractAddress: address(nft), tokenId: tokenIdA });

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price * 2);
        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 mintedA = _mintWithExpected(minterAddr, DEFAULT_SALT, refs, price);
        refs[0].tokenId = tokenIdB;
        _commitAndFulfill(minterAddr, keccak256("salt-b"), refs, DEFAULT_RANDOMNESS + 1);
        uint256 mintedB = _mintWithExpected(minterAddr, keccak256("salt-b"), refs, price);

        assertTrue(mintedA != mintedB);
    }

    function testMintSucceedsWithGasHeavyOwner() public {
        ReceiverConsumesGasOnReceive gasOwner = new ReceiverConsumesGasOnReceive();
        vm.prank(owner);
        minter = new CubixlesMinter(
            address(gasOwner),
            address(lessToken),
            500,
            _pricingConfig(0, 0, 0, false),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
        );

        address minterAddr = makeAddr("minter");
        uint256 tokenId = nft.mint(minterAddr);
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](1);
        refs[0] = CubixlesMinter.NftRef({ contractAddress: address(nft), tokenId: tokenId });

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        _mintWithExpected(minterAddr, DEFAULT_SALT, refs, price);
        assertEq(address(gasOwner).balance, price);
    }

    function testMintRevertsOnReentrantOwnerReceive() public {
        MaliciousReceiverReenter malicious = new MaliciousReceiverReenter();
        vm.prank(owner);
        minter.transferOwnership(address(malicious));

        address minterAddr = makeAddr("minter");
        uint256 tokenId = nft.mint(minterAddr);
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](1);
        refs[0] = CubixlesMinter.NftRef({ contractAddress: address(nft), tokenId: tokenId });

        address[] memory reenterContracts = new address[](1);
        uint256[] memory reenterTokenIds = new uint256[](1);
        reenterContracts[0] = address(nft);
        reenterTokenIds[0] = tokenId;
        malicious.configure(
            minter,
            reenterContracts,
            reenterTokenIds,
            DEFAULT_SALT
        );

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 mintedId = _mintWithExpected(minterAddr, DEFAULT_SALT, refs, price);
        assertEq(minter.ownerOf(mintedId), minterAddr);
    }
}
