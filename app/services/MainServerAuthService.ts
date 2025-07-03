import MainServerAxiosService from "./MainServerAxiosService.js";

class MainServerAuthService {
  async authenticateUserToken(
    userId: string,
    token: string
  ) {
   const data = await MainServerAxiosService.post('/auth/verify-user-token', {
    userId,
    token
   });
   if (data.status === 200) {
    return true;
   } else {
    return false;
   }
  }
}

export default new MainServerAuthService();
