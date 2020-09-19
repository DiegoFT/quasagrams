<template>
  <q-page class="constrain-more q-pa-md">
    <div class="camera-frame q-pa-md">
      <video v-show="!imageCaptured" ref="video" class="full-width" autoplay />
      <canvas v-show="imageCaptured" ref="canvas" class="full-width" height="240"></canvas>
    </div>
    <div class="text-center q-pa-md">
      <q-btn
        v-if="hasCameraSupport"
        round
        :disable="imageCaptured"
        color="grey-10"
        size="lg"
        icon="eva-camera"
        @click="captureImage" />
      <q-file
        v-else
        outlined
        accept="image/*"
        label="Choose an image"
        v-model="imageUpload"
        @input="captureImageFallback">
        <template v-slot:prepend>
          <q-icon name="eva-attach-outline" />
        </template>
      </q-file>
      <div class="row justify-center q-ma-md">
        <q-input
          v-model="post.caption"
          class="col col-sm-6"
          :label="$t('caption')"
          dense />
      </div>
      <div class="row justify-center q-ma-md">
        <q-input
          v-model="post.location"
          class="col col-sm-6"
          :label="$t('location')"
          :loading="locationLoading"
          dense>
          <template v-slot:append>
            <q-btn
              v-if="!locationLoading && locationSupported"
              round
              dense
              flat
              @click="getLocation"
              icon="eva-navigation-2-outline" />
          </template>
        </q-input>
      </div>
      <div class="row justify-center q-mt-lg">
        <q-btn
          @click="addPost"
          :disable="!post.caption || !post.photo"
          unelevated
          rounded
          color="primary"
          label="Post image" />
      </div>
    </div>
  </q-page>
</template>

<script>
import {
  uid
} from 'quasar'
require('md-gum-polyfill')
export default {
  name: 'PageCamera',
  data() {
    return {
      post: {
        id: uid(),
        caption: '',
        location: '',
        photo: null,
        date: Date.now(),
      },
      imageCaptured: false,
      hasCameraSupport: true,
      imageUpload: [],
      locationLoading: false,
    }
  },
  computed: {
    locationSupported() {
      if ('geolocation' in navigator) return true
      return false
    },
    backgroundSyncSupported() {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        return true
      }
      return false
    }
  },
  methods: {
    initCamera() {
      navigator.mediaDevices.getUserMedia({
        video: true
      }).then(stream => {
        this.$refs.video.srcObject = stream
      }).catch(error => {
        this.hasCameraSupport = false
      })
    },
    getLocation() {
      this.locationLoading = true
      navigator.geolocation.getCurrentPosition(position => {
        this.getCityAndCountry(position)
      }, err => {
        this.locationError()
      }, {
        timeout: 7000
      })
    },
    getCityAndCountry(position) {
      let apiUrl = `https://geocode.xyz/${ position.coords.latitude },${ position.coords.longitude }?json=1`
      this.$axios.get(apiUrl)
        .then(result => {
          this.locationSuccess(result)
        })
        .catch(err => {
          this.locationError()
        })
    },
    locationSuccess(result) {
      this.post.location = result.data.city
      if (result.data.country) {
        this.post.location += `, ${ result.data.country }`
      }
      this.locationLoading = false
    },
    locationError() {
      this.$q.dialog({
        title: 'Error',
        message: 'Could not find your location'
      })
      this.locationLoading = false
    },
    captureImage() {
      let video = this.$refs.video
      let canvas = this.$refs.canvas
      canvas.width = video.getBoundingClientRect().width
      canvas.height = video.getBoundingClientRect().height
      let context = canvas.getContext('2d')
      // video, coord x, coord y, width, height
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      this.imageCaptured = true
      this.post.photo = this.dataURItoBlob(canvas.toDataURL())
      this.disableCamera()
    },
    captureImageFallback(file) {
      this.post.photo = file

      let canvas = this.$refs.canvas
      let context = canvas.getContext('2d')

      var reader = new FileReader()
      reader.onload = (event) => {
        var img = new Image()
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          context.drawImage(img, 0, 0)
          this.imageCaptured = true
        }
        img.src = event.target.result
      }
      reader.readAsDataURL(file)
    },
    disableCamera() {
      this.$refs.srcObject.getVideoTracks().forEach(track => {
        track.stop()
      })
    },
    dataURItoBlob(dataURI) {
      // convert base64 to raw binary data held in a string
      // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
      var byteString = atob(dataURI.split(',')[1])

      // separate out the mime component
      var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

      // write the bytes of the string to an ArrayBuffer
      var ab = new ArrayBuffer(byteString.length)

      // create a view into the buffer
      var ia = new Uint8Array(ab)

      // set the bytes of the buffer to the correct values
      for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }

      // write the ArrayBuffer to a blob, and you're done
      var blob = new Blob([ab], {
        type: mimeString
      });
      return blob;
    },
    addPost() {
      this.$q.loading.show()

      let formData = new FormData()
      formData.append('id', this.post.id)
      formData.append('caption', this.post.caption)
      formData.append('location', this.post.location)
      formData.append('date', this.post.date)
      formData.append('file', this.post.photo, this.post.id + '.png')

      let url = `${process.env.API}/createPost`
      this.$axios.post(url, formData)
        .then(response => {
          console.log('response', response)
          this.$router.push('/')
          this.$q.notify({
            message: this.$t('postCreated'),
            actions: [{
              label: 'Dismiss',
              color: 'white'
            }]
          })
          this.$q.loading.hide()
        })
        .catch(err => {
          console.log('err: ', err)
          if (!navigator.onLine && this.backgroundSyncSupported) {
            //redirect to home
            this.$q.notify('Post created offline!')
            this.$router.push('/')
          } else {
            this.$q.dialog({
              title: 'Error',
              message: 'Sorry, could not create post!'
            })
          }
          this.$q.loading.hide()
        })
    }
  },
  mounted() {
    this.initCamera()
  },
  beforeDestroy() {
    if (this.hasCameraSupport) {
      this.disableCamera()
    }
  }
}
</script>

<style lang="sass">
  .camera-frame
    border: 2px solid $grey-10
    border-radius: 10px
</style>
