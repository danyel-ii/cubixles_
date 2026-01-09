// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { CubixlesMinter } from "../../src/cubixles/CubixlesMinter.sol";

contract ReceiverRevertsOnReceive {
    receive() external payable {
        revert("Receive reverted");
    }
}

contract ReceiverConsumesGasOnReceive {
    uint256 public counter;

    receive() external payable {
        for (uint256 i = 0; i < 1000; i += 1) {
            counter += i;
        }
    }
}

contract MaliciousReceiverReenter {
    CubixlesMinter public minter;
    address[] public refContracts;
    uint256[] public refTokenIds;
    bytes32 public salt;
    bool public attempted;
    bytes32 private constant METADATA_HASH = keccak256("metadata");
    bytes32 private constant IMAGE_PATH_HASH = keccak256("image-path");

    function configure(
        CubixlesMinter minter_,
        address[] calldata refContracts_,
        uint256[] calldata refTokenIds_,
        bytes32 salt_
    ) external {
        minter = minter_;
        refContracts = refContracts_;
        refTokenIds = refTokenIds_;
        salt = salt_;
        attempted = false;
    }

    receive() external payable {
        if (attempted) {
            return;
        }
        attempted = true;
        uint256 len = refContracts.length;
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](len);
        for (uint256 i = 0; i < len; i += 1) {
            refs[i] = CubixlesMinter.NftRef({
                contractAddress: refContracts[i],
                tokenId: refTokenIds[i]
            });
        }
        try minter.mint{ value: 0 }(
            salt,
            refs,
            0,
            "ipfs://metadata/0",
            METADATA_HASH,
            IMAGE_PATH_HASH
        ) {} catch {}
    }
}
