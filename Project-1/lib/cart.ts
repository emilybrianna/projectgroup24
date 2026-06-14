import AsyncStorage from "@react-native-async-storage/async-storage";

export type CartItem = {
  id: number | string;
  name: string;
  size: string;
  color: string;
  price: number;
  quantity: number;
};

const CART_STORAGE_KEY = "smartfashCart";

export async function getCartItems() {
  const savedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
  return savedCart ? (JSON.parse(savedCart) as CartItem[]) : [];
}

export async function saveCartItems(items: CartItem[]) {
  await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export async function addCartItem(item: Omit<CartItem, "quantity">) {
  const items = await getCartItems();
  const existingItem = items.find((cartItem) => cartItem.id === item.id);

  if (existingItem) {
    const nextItems = items.map((cartItem) =>
      cartItem.id === item.id
        ? { ...cartItem, quantity: cartItem.quantity + 1 }
        : cartItem
    );

    await saveCartItems(nextItems);
    return nextItems;
  }

  const nextItems = [...items, { ...item, quantity: 1 }];
  await saveCartItems(nextItems);
  return nextItems;
}

export async function clearCartItems() {
  await AsyncStorage.removeItem(CART_STORAGE_KEY);
}
