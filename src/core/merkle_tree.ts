import { Hasher } from "../hasher";

export class MerkleTree {
    private hasher: Hasher;
    private nodes: Map<number, Buffer> = new Map();
    private depth: number;
    private emptyHashes: { [key: number]: Buffer } = {};
    private leafBytes: number;
  
    constructor(hasher: Hasher, depth: number, leafBytes: number) {
      this.hasher = hasher;
      this.depth = depth;
      this.leafBytes = leafBytes;
      this.populateEmptyHashes();
    }
  
    private populateEmptyHashes() {
      var hash = this.hasher.hash(Buffer.alloc(this.leafBytes));
      for (let d = 0; d <= this.depth; ++d) {
        this.emptyHashes[this.depth - d] = hash;
        hash = this.hasher.compress(hash, hash);
      }
    }
  
    /**
     * Get the root of the tree.
     * @returns root of the tree
     */
    getRoot() {
      return this.get(0);
    }
  
    /**
     * Get the node at the given index.
     * @param index
     * @returns node at the index. If the node is not present, return the empty hash at the depth.
     */
    get(index: number) {
      const depth = this.calculateIndexDepth(index);
      return this.nodes.get(index) || this.emptyHashes[depth];
    }
  
    /**
     * Set the node at the given index.
     * @param index
     * @param value
     */
    set(index: number, hash: Buffer) {
      this.nodes.set(index, hash);
  
      let parentIdx = index;
      while (parentIdx >= 0) {
        parentIdx = parentIdx % 2 === 0 ? (parentIdx - 2) / 2 : (parentIdx - 1) / 2;
        if (parentIdx < 0) {
          break;
        }
  
        const left = this.get(parentIdx * 2 + 1);
        const right = this.get(parentIdx * 2 + 2);
        this.nodes.set(parentIdx, this.hasher.compress(left, right));
      }
    }
  
    /**
     * Get the hash path for the given index.
     * @param index
     * @returns hash path for the index.
     */
    getPath(index: number) {
      const path: Buffer[][] = [];
  
      let parentIdx = index;
      while (parentIdx >= 0) {
        parentIdx = parentIdx % 2 === 0 ? (parentIdx - 2) / 2 : (parentIdx - 1) / 2;
        if (parentIdx < 0) {
          break;
        }
  
        const left = this.get(parentIdx * 2 + 1);
        const right = this.get(parentIdx * 2 + 2);
        path.push([left, right]);
      }
  
      return path;
    }
  
    /**
     * Calculate the depth of an index. Assuming indexing starts from
     * the root, the depth would be the closest power of 2 for the (index + 1).
     * @param index
     * @returns depth of the element
     */
    private calculateIndexDepth(index: number) {
      return Math.floor(Math.log2(index + 1));
    }
  }