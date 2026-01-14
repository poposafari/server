export interface AuthLocalReq {
  username: string;
  password: string;
}

export interface AuthSuccessRes {
  success: true;
  data: {
    accessToken: string;
    //refreshToken: string;
  };
}
