import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,

    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
  ) {
    this.ordersRepository = ordersRepository;
    this.productsRepository = productsRepository;
    this.customersRepository = customersRepository;
  }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not exist!');
    }

    const productsToOrder = await this.productsRepository.findAllById(products);

    if (!productsToOrder || products.length !== productsToOrder.length) {
      throw new AppError('One ou more product(s) not exist in the store!');
    }

    const productsOutOfStock = products.filter(prod => {
      const checkQuantity = productsToOrder.find(
        product => product.id === prod.id,
      )?.quantity;

      if (!checkQuantity) {
        return false;
      }
      return prod.quantity > Number(checkQuantity);
    });

    if (productsOutOfStock.length > 0) {
      throw new AppError('One ou more product(s) not in the stock!');
    }

    const serializedProducts = products.map(product => {
      return {
        product_id: product.id,
        quantity: product.quantity,
        price: productsToOrder.filter(p => p.id === product.id)[0].price,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: serializedProducts,
    });

    const orderedProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        productsToOrder.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
