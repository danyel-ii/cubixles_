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
        _advanceToReveal(minterAddr);
    }

    function _advanceToReveal(address minterAddr) internal {
        (, uint256 commitBlock, , , , , ) = minter.mintCommitByMinter(minterAddr);
        uint256 revealBlock = commitBlock + minter.COMMIT_REVEAL_DELAY_BLOCKS();
        vm.roll(revealBlock + 1);
    }

    function _commitMetadata(address minterAddr) internal {
        uint256 expected = minter.previewPaletteIndex(minterAddr);
        vm.prank(minterAddr);
        minter.commitMetadata(METADATA_HASH, IMAGE_PATH_HASH, expected);
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

    function _buildTokenURI(uint256 paletteIndex) internal pure returns (string memory) {
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
        vm.prank(minterAddr);
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
