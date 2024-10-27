import { LevelUp, LevelUpChain } from 'levelup';
import subleveldown from 'subleveldown';
import { HashPath } from './hash_path';
import { MerkleTree} from './core/merkle_tree'
import { Hasher } from './hasher';

const MAX_DEPTH = 32;
const LEAF_BYTES = 64; // All leaf values are 64 bytes.

export class DbMerkleTree {

  private itemsDb: LevelUp;
  private inMemoryTree: MerkleTree;

  constructor(private db: LevelUp, private name: string, private depth: number, private hasher: Hasher) {
    if (!(depth >= 1 && depth <= MAX_DEPTH)) {
      throw Error('Bad depth');
    }
    this.name = name;
    this.depth = depth;
    this.hasher = hasher;
    this.inMemoryTree = new MerkleTree(this.hasher, depth,LEAF_BYTES);

    this.db = db;
    this.itemsDb = subleveldown(db, name);
  }

  static async new(db: LevelUp, name: string, hasher: Hasher, depth = MAX_DEPTH) {
    const meta: Buffer = await db.get(Buffer.from(name)).catch(() => {});
    if (meta) {
      const root = meta.slice(0, 32);
      const depth = meta.readUInt32LE(32);
      const tree = new DbMerkleTree(db, name, depth,hasher);
      await tree.restoreElements();
      if (!tree.getRoot().equals(root)) {
        throw Error('Root mismatch');
      }
      return tree;
    } else {
      const tree = new DbMerkleTree(db, name, depth, hasher);
      await tree.writeMetaData();
      return tree;
    }
  }

  private async writeMetaData(batch?: LevelUpChain<string, Buffer>) {
    const data = Buffer.alloc(40);
    this.getRoot().copy(data);
    data.writeUInt32LE(this.depth, 32);
    if (batch) {
      batch.put(this.name, data);
    } else {
      await this.db.put(this.name, data);
    }
  }

  private async restoreElements() {
    return new Promise((resolve, reject) => {
      const stream = this.itemsDb.createReadStream();
      stream.on('data', (data) => {
        const index = parseInt(data.key.toString());
        this.inMemoryTree.set(this.elementTreeIndex(index), Buffer.from(data.value, 'hex'));
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  }

  getRoot() {
    return this.inMemoryTree.getRoot();
  }

  async getHashPath(index: number) {
    return new HashPath(this.inMemoryTree.getPath(this.elementTreeIndex(index)));
  }

  async updateElement(index: number, value: Buffer) {
    const hash = this.hasher.hash(value);
    this.inMemoryTree.set(this.elementTreeIndex(index), hash);

    await this.itemsDb.put(index.toString(), hash.toString('hex'));
    await this.writeMetaData();

    return this.getRoot();
  }

  private elementTreeIndex(index: number) {
    return index + Math.pow(2, this.depth) - 1;
  }
}