"use client"

import Swal from 'sweetalert2'


export const toast = Swal.mixin({
  toast: true,
  position: 'center',
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
  showCloseButton: false,
  background: '#111827',
  color: '#E5E7EB',
  iconColor: '#A3A3A3',
  customClass: {
    popup: 'swal2-neutral-popup border border-neutral-700 rounded-xl shadow-xl',
    title: 'swal2-neutral-title text-white font-medium',
    timerProgressBar: 'bg-neutral-600'
  },
  didOpen: (toastEl) => {
    toastEl.addEventListener('mouseenter', Swal.stopTimer)
    toastEl.addEventListener('mouseleave', Swal.resumeTimer)
  }
})

export const showSuccess = (title: string, text?: string) => {
  toast.fire({ icon: 'success', title, text })
}

export const showError = (title: string, text?: string) => {
  toast.fire({ icon: 'error', title, text })
}

export const showInfo = (title: string, text?: string) => {
  toast.fire({ icon: 'info', title, text })
}

export const showWarning = (title: string, text?: string) => {
  toast.fire({ icon: 'warning', title, text })
}
