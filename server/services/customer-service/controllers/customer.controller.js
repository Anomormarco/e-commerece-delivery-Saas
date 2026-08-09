import { userIdFromRequest } from "@deliverhub/server-platform/http/request-context";
import {
  createCustomerOrder,
  getCurrentCustomerTracking,
  listCustomerStores,
  loginCustomer,
  registerCustomer,
} from "../services/customer.service.js";

export async function register(request, response) {
  response.status(201).json(await registerCustomer(request.body));
}

export async function login(request, response) {
  response.json(await loginCustomer(request.body));
}

export async function createOrder(request, response) {
  response.status(201).json(await createCustomerOrder(userIdFromRequest(request), request.body));
}

export async function listStores(request, response) {
  response.json(await listCustomerStores(userIdFromRequest(request), request.query));
}

export async function showCurrentCustomerTracking(request, response) {
  response.json(await getCurrentCustomerTracking(userIdFromRequest(request)));
}
