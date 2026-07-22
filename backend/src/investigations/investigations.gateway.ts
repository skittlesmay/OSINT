import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway()
export class InvestigationsGateway {
  @WebSocketServer()
  public server: Server;
  @SubscribeMessage('join_investigation!')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { investigationId: string },
  ) {
    void client.join(data.investigationId);
    console.log(
      `Client ${client.id} подключился к osint ${data.investigationId}`,
    );
  }
}
