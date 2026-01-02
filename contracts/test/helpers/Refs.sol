// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { CubixlesMinter } from "../../src/cubixles/CubixlesMinter.sol";

library Refs {
    function hashCanonical(
        CubixlesMinter.NftRef[] memory refs
    ) internal pure returns (bytes32) {
        CubixlesMinter.NftRef[] memory sorted = new CubixlesMinter.NftRef[](refs.length);
        for (uint256 i = 0; i < refs.length; i += 1) {
            sorted[i] = refs[i];
        }
        for (uint256 i = 1; i < sorted.length; i += 1) {
            CubixlesMinter.NftRef memory key = sorted[i];
            uint256 j = i;
            while (j > 0) {
                CubixlesMinter.NftRef memory prev = sorted[j - 1];
                if (
                    prev.contractAddress < key.contractAddress ||
                    (prev.contractAddress == key.contractAddress && prev.tokenId <= key.tokenId)
                ) {
                    break;
                }
                sorted[j] = prev;
                j -= 1;
            }
            sorted[j] = key;
        }
        bytes memory packed = "";
        for (uint256 i = 0; i < sorted.length; i += 1) {
            packed = abi.encodePacked(packed, sorted[i].contractAddress, sorted[i].tokenId);
        }
        return keccak256(packed);
    }
}
