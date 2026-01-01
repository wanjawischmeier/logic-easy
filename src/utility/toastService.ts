import { POSITION, useToast } from "vue-toastification";

const toast = useToast();

export class Toast {
    static baseProps = {
        position: POSITION.BOTTOM_CENTER,
        draggablePercent: 0.6,
        closeOnClick: true,
        pauseOnFocusLoss: true,
        draggable: true,
        showCloseButtonOnHover: false,
        closeButton: "button",
        icon: true,
        rtl: false,
    }

    static info(error: string) {
        toast.info(error, {
            ...this.baseProps,
            timeout: 3000,
            pauseOnHover: true,
            hideProgressBar: false,
        });
    }

    static warning(error: string) {
        toast.warning(error, {
            ...this.baseProps,
            timeout: 5000,
            pauseOnHover: true,
            hideProgressBar: false,
        });
    }

    static error(error: string) {
        toast.error(error, {
            ...this.baseProps,
            timeout: 10000,
            pauseOnHover: false,
            hideProgressBar: true,
        });
    }
}