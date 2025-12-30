spec RoyaltySplitterSpec {
  methods {
    owner() returns (address);
    swapEnabled() returns (bool);
  }

  rule ownerIsNonZero {
    env e;
    assert owner() != 0x0000000000000000000000000000000000000000;
  }
}
