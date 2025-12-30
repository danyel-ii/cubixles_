spec IceCubeMinterSpec {
  methods {
    resaleSplitter() returns (address);
    royaltyInfo(uint256,uint256) returns (address,uint256);
  }

  rule royaltyReceiverIsSplitter {
    env e;
    uint256 tokenId;
    uint256 salePrice;
    address receiver;
    uint256 amount;
    (receiver, amount) = royaltyInfo(tokenId, salePrice);
    assert receiver == resaleSplitter();
  }
}
