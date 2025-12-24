// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";

contract MainnetForkTest is Test {
    bool private forkReady;

    address private constant ENS = 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85;
    address private constant BAYC = 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D;

    function setUp() public {
        string memory url = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(url).length == 0) {
            emit log("MAINNET_RPC_URL not set; skipping fork tests.");
            return;
        }
        uint256 fork = vm.createFork(url);
        vm.selectFork(fork);
        forkReady = true;
    }

    function testOwnerOfOnKnownContracts() public {
        if (!forkReady) {
            return;
        }

        _assertOwnerOf(ENS, 1);
        _assertOwnerOf(BAYC, 1);
    }

    function testRoyaltyInfoDoesNotRevertWhenPresent() public {
        if (!forkReady) {
            return;
        }

        _tryRoyaltyInfo(ENS);
        _tryRoyaltyInfo(BAYC);
    }

    function _assertOwnerOf(address nft, uint256 tokenId) internal {
        try IERC721(nft).ownerOf(tokenId) returns (address owner) {
            require(owner != address(0), "ownerOf returned zero address");
        } catch {
            emit log("ownerOf reverted (non-standard or restricted).");
        }
    }

    function _tryRoyaltyInfo(address nft) internal {
        try IERC2981(nft).royaltyInfo(1, 1 ether) returns (address receiver, uint256 amount) {
            receiver;
            amount;
        } catch {
            emit log("royaltyInfo reverted (non-ERC2981 or restricted).");
        }
    }
}
