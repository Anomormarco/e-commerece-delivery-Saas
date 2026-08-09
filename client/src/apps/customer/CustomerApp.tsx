import { CustomerPage } from "../../features/customer/CustomerPage";
import { TopNav } from "../../features/navigation/TopNav";

export function CustomerApp() {
  return (
    <>
      <TopNav activeRoute="customer" />
      <CustomerPage />
    </>
  );
}

export default CustomerApp;
