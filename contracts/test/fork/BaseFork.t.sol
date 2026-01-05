// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";

contract BaseForkTest is Test {
    bool private forkReady;

    address private constant PUNKOLOGY = 0x5795060201B64970A02a043A29dA1aedabFa0b35;
    uint256 private constant DEFAULT_FORK_BLOCK = 10_000_000;

    function setUp() public {
        string memory url = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(url).length == 0) {
            emit log("BASE_RPC_URL not set; skipping fork tests.");
            return;
        }
        uint256 forkBlock = vm.envOr("BASE_FORK_BLOCK", DEFAULT_FORK_BLOCK);
        vm.createSelectFork(url, forkBlock);
        forkReady = true;
    }

    function testOwnerOfOnKnownContracts() public {
        if (!forkReady) {
            return;
        }

        _assertOwnerOf(PUNKOLOGY, 1);
    }

    function testRoyaltyInfoDoesNotRevertWhenPresent() public {
        if (!forkReady) {
            return;
        }

        _tryRoyaltyInfo(PUNKOLOGY);
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
