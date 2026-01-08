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

    static info(text: string) {
        toast.info(text, {
            ...this.baseProps,
            timeout: 3000,
            pauseOnHover: true,
            hideProgressBar: false,
        });
    }

    static warning(text: string) {
        toast.warning(text, {
            ...this.baseProps,
            timeout: 5000,
            pauseOnHover: true,
            hideProgressBar: false,
        });
    }

    static error(text: string) {
        toast.error(text, {
            ...this.baseProps,
            timeout: 10000,
            pauseOnHover: false,
            hideProgressBar: true,
        });
    }
}