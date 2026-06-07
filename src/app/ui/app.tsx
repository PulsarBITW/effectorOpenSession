import { useUnit } from "effector-react";
import { Button, Container, Text, Modal, Skeleton } from "@mantine/core";

import { appModel } from "@app/model";

export const App = () => {
  const openModal = useUnit(appModel.modal.open);

  return (
    <Container>
      <Container size="sm">
        <Button onClick={openModal}>Open modal</Button>

        <StatusModal />
      </Container>
    </Container>
  );
};

const StatusModal = () => {
  const [isOpen, status, closeModal, sendRequest, isLoading] = useUnit([
    appModel.modal.$isOpen,
    appModel.modal.$status,
    appModel.modal.close,
    appModel.sendRequest,
    appModel.$isLoading,
  ]);

  return (
    <Modal opened={isOpen} onClose={closeModal} title="Status modal">
      <Skeleton visible={isLoading} height={80} width={200} />
      <Text>{status || "-"}</Text>
      <Button onClick={sendRequest}>send request</Button>
    </Modal>
  );
};
