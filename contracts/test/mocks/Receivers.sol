// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IceCubeMinter } from "../../src/icecube/IceCubeMinter.sol";

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
    IceCubeMinter public minter;
    address[] public refContracts;
    uint256[] public refTokenIds;
    string public tokenUri;
    bool public attempted;

    function configure(
        IceCubeMinter minter_,
        address[] calldata refContracts_,
        uint256[] calldata refTokenIds_,
        string calldata tokenUri_
    ) external {
        minter = minter_;
        refContracts = refContracts_;
        refTokenIds = refTokenIds_;
        tokenUri = tokenUri_;
        attempted = false;
    }

    receive() external payable {
        if (attempted) {
            return;
        }
        attempted = true;
        uint256 len = refContracts.length;
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](len);
        for (uint256 i = 0; i < len; i += 1) {
            refs[i] = IceCubeMinter.NftRef({
                contractAddress: refContracts[i],
                tokenId: refTokenIds[i]
            });
        }
        try minter.mint{ value: 0 }(tokenUri, refs) {} catch {}
    }
}
