import ItemModel from "../models/item.model";
import { Item } from "../../../../types/schema";
import { paginatedData, DetailedGatePass } from "../../../../types/paginatedData";

class ItemService {
  async getAllItem(): Promise<Item[]> {
    return await ItemModel.item.gpFindMany();
  }

  async getOutOfStockItems(): Promise<Item[]> {
    return await ItemModel.item.outOfStockItems();
  }

  async getItem(page: number, pageSize: number): Promise<paginatedData> {
    return await ItemModel.item.gpPgFindMany(page, pageSize);
  }

  async getDeletedItem(page: number, pageSize: number): Promise<paginatedData> {
    return await ItemModel.item.gpPgFindDeletedMany(page, pageSize);
  }

  async createItem(itemData: Item | Item[]): Promise<Item | Item[]> {
    return await ItemModel.item.gpCreate(itemData);
  }

  async updateItem(itemId: string, itemData: Item): Promise<Item | null> {
    return await ItemModel.item.gpUpdate(itemId, itemData);
  }

  async deleteItem(itemId: string): Promise<void> {
    await ItemModel.item.gpSoftDelete(itemId);
  }

  async restoreItem(itemId: string): Promise<void> {
    await ItemModel.item.gpRestore(itemId);
  }

  async getItemById(itemId: string): Promise<Item | null> {
    return await ItemModel.item.gpFindById(itemId);
  }

  async getTotalItem(): Promise<number> {
    return await ItemModel.item.gpCount();
  }

  async searchItems(
    searchTerm: string | string[],
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    const columns: string[] = ["name", "description"];
    return await ItemModel.item.gpSearch(searchTerm, columns, page, pageSize);
  }

  async getBySerialNo(serialNo: string): Promise<DetailedGatePass | null> {
    return await ItemModel.item.findBySerialNo(serialNo);
  }
}

export default ItemService;
