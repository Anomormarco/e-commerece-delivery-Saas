import { userIdFromRequest } from "@deliverhub/server-platform/http/request-context";
import {
  confirmQpayPayment,
  createCustomerOrder,
  getCurrentCustomerTracking,
  listCustomerOrderHistory,
  listCustomerStores,
  loginCustomer,
  registerCustomer,
  updateCustomerProfile,
} from "../services/customer.service.js";

export async function register(request, response) {
  response.status(201).json(await registerCustomer(request.body));
}

export async function login(request, response) {
  response.json(await loginCustomer(request.body));
}

export async function updateProfile(request, response) {
  response.json(await updateCustomerProfile(userIdFromRequest(request), request.body));
}

export async function createOrder(request, response) {
  response.status(201).json(await createCustomerOrder(userIdFromRequest(request), request.body));
}

export async function checkQpayPayment(request, response) {
  response.json(await confirmQpayPayment(request.body));
}

export async function listStores(request, response) {
  response.json(await listCustomerStores(userIdFromRequest(request), request.query));
}

export async function showCurrentCustomerTracking(request, response) {
  response.json(await getCurrentCustomerTracking(userIdFromRequest(request)));
}

export async function listOrderHistory(request, response) {
  response.json(await listCustomerOrderHistory(userIdFromRequest(request), request.query));
}
