import FileItem from "#models/file_item";
import MainServerAxiosService from "./MainServerAxiosService.js";

class UploadService {
  async uploadFinish(
    file: FileItem
  ) {
    const res = await MainServerAxiosService.post(`/coordinator/v1/ack`, file)
    if (res.status === 200) {
      return true;
    }
    return false;
  
  }
}

export default new UploadService();
