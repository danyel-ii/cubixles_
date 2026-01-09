// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { CubixlesMinter } from "../../src/cubixles/CubixlesMinter.sol";
import { MockERC721Standard } from "../mocks/MockERC721s.sol";
import { MockERC20 } from "../mocks/MockERC20.sol";
import { Refs } from "../helpers/Refs.sol";

contract CubixlesMinterFuzzTest is Test {
    CubixlesMinter private minter;
    MockERC721Standard private nft;
    MockERC20 private lessToken;
    address private owner = makeAddr("owner");
    address private resaleSplitter = makeAddr("splitter");
    address private vrfCoordinator = makeAddr("vrfCoordinator");
    bytes32 private constant VRF_KEY_HASH = keccak256("vrf-key");
    uint64 private constant VRF_SUB_ID = 1;
    uint16 private constant VRF_CONFIRMATIONS = 3;
    uint32 private constant VRF_CALLBACK_GAS_LIMIT = 200_000;
    uint256 private constant DEFAULT_RANDOMNESS = 123_456;
    string private constant PALETTE_IMAGES_CID = "bafyimagescid";
    bytes32 private constant PALETTE_MANIFEST_HASH = keccak256("manifest");
    string private constant TOKEN_URI_PREFIX = "ipfs://metadata/";
    bytes32 private constant METADATA_HASH = keccak256("metadata");
    bytes32 private constant IMAGE_PATH_HASH = keccak256("image-path");

    function _commitMint(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs
    ) internal {
        bytes32 refsHash = Refs.hashCanonical(refs);
        bytes32 commitment = minter.computeCommitment(minterAddr, salt, refsHash);
        vm.prank(minterAddr);
        minter.commitMint(commitment);
        vm.roll(block.number + 1);
        (, , uint256 requestId, , , , , , , ) = minter.mintCommitByMinter(minterAddr);
        uint256[] memory words = new uint256[](1);
        words[0] = DEFAULT_RANDOMNESS;
        vm.prank(vrfCoordinator);
        minter.rawFulfillRandomWords(requestId, words);
    }

    function _commitMetadata(address minterAddr) internal {
        vm.prank(minterAddr);
        minter.commitMetadata(METADATA_HASH, IMAGE_PATH_HASH);
    }

    function setUp() public {
        vm.startPrank(owner);
        lessToken = new MockERC20("LESS", "LESS");
        minter = new CubixlesMinter(
            resaleSplitter,
            address(lessToken),
            500,
            0,
            0,
            0,
            false,
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            vrfCoordinator,
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
        vm.stopPrank();
        nft = new MockERC721Standard("MockNFT", "MNFT");
    }

    function _buildRefs(address minterAddr, uint8 count) internal returns (CubixlesMinter.NftRef[] memory refs) {
        refs = new CubixlesMinter.NftRef[](count);
        for (uint256 i = 0; i < count; i += 1) {
            uint256 tokenId = nft.mint(minterAddr);
            refs[i] = CubixlesMinter.NftRef({
                contractAddress: address(nft),
                tokenId: tokenId
            });
        }
    }

    function _buildTokenURI(uint256 paletteIndex) internal view returns (string memory) {
        return string.concat(TOKEN_URI_PREFIX, vm.toString(paletteIndex));
    }

    function testFuzz_PaymentBoundary(uint256 paymentRaw, uint8 countRaw) public {
        uint8 count = uint8(bound(countRaw, 1, 6));
        uint256 payment = bound(paymentRaw, 0, 1 ether);
        address minterAddr = makeAddr("minter");
        uint256 price = minter.currentMintPrice();

        CubixlesMinter.NftRef[] memory refs = _buildRefs(minterAddr, count);
        bytes32 salt = keccak256(abi.encodePacked(minterAddr, count, payment));
        vm.deal(minterAddr, payment);

        if (payment < price) {
            _commitMint(minterAddr, salt, refs);
            vm.prank(minterAddr);
            vm.expectRevert(CubixlesMinter.InsufficientEth.selector);
            minter.mint{ value: payment }(
                salt,
                refs,
                0,
                _buildTokenURI(0),
                METADATA_HASH,
                IMAGE_PATH_HASH
            );
            return;
        }

        uint256 splitterBefore = resaleSplitter.balance;
        uint256 minterBefore = minterAddr.balance;
        _commitMint(minterAddr, salt, refs);
        uint256 expected = minter.previewPaletteIndex(minterAddr);
        string memory tokenUri = _buildTokenURI(expected);
        _commitMetadata(minterAddr);
        vm.prank(minterAddr);
        minter.mint{ value: payment }(
            salt,
            refs,
            expected,
            tokenUri,
            METADATA_HASH,
            IMAGE_PATH_HASH
        );

        assertEq(resaleSplitter.balance, splitterBefore + price);
        assertEq(minterAddr.balance, minterBefore - price);
    }

    function testFuzz_OwnershipGate(uint8 countRaw, bool injectWrongOwner) public {
        uint8 count = uint8(bound(countRaw, 1, 6));
        address minterAddr = makeAddr("minter");
        address other = makeAddr("other");

        CubixlesMinter.NftRef[] memory refs = _buildRefs(minterAddr, count);
        uint256 wrongTokenId = 0;
        if (injectWrongOwner) {
            wrongTokenId = nft.mint(other);
            refs[count - 1].tokenId = wrongTokenId;
        }

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
        _commitMint(minterAddr, keccak256("salt"), refs);
        vm.prank(minterAddr);
        if (injectWrongOwner) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    CubixlesMinter.RefNotOwned.selector,
                    address(nft),
                    wrongTokenId,
                    minterAddr,
                    other
                )
            );
            minter.mint{ value: price }(
                keccak256("salt"),
                refs,
                0,
                _buildTokenURI(0),
                METADATA_HASH,
                IMAGE_PATH_HASH
            );
            return;
        }
        uint256 expected = minter.previewPaletteIndex(minterAddr);
        string memory tokenUri = _buildTokenURI(expected);
        _commitMetadata(minterAddr);
        minter.mint{ value: price }(
            keccak256("salt"),
            refs,
            expected,
            tokenUri,
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }
}
