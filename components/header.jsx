import { checkUser } from "@/lib/checkUser";
import { HeaderClient } from "./header-client";

 const Header = async () => {
  await checkUser();
  return <HeaderClient />;
};

export default Header;