package com.nyayarack.legalmanager

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

class CryptoModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "CryptoModule"
    }

    @ReactMethod
    fun hashPassword(password: String, saltHex: String, iterations: Int, keyLength: Int, promise: Promise) {
        try {
            val salt = hexStringToByteArray(saltHex)
            // keyLength is in bits (e.g. 256 bits for 32 bytes)
            val spec = PBEKeySpec(password.toCharArray(), salt, iterations, keyLength)
            val skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            val result = skf.generateSecret(spec).encoded
            val hexResult = byteArrayToHexString(result)
            promise.resolve(hexResult)
        } catch (e: Exception) {
            promise.reject("HASH_ERROR", e.message, e)
        }
    }

    private fun hexStringToByteArray(s: String): ByteArray {
        val len = s.length
        val data = ByteArray(len / 2)
        var i = 0
        while (i < len) {
            val d1 = Character.digit(s[i], 16)
            val d2 = Character.digit(s[i + 1], 16)
            data[i / 2] = ((d1 shl 4) + d2).toByte()
            i += 2
        }
        return data
    }

    private fun byteArrayToHexString(bytes: ByteArray): String {
        val hexChars = "0123456789abcdef"
        val result = StringBuilder(bytes.size * 2)
        for (b in bytes) {
            val i = b.toInt() and 0xFF
            result.append(hexChars[i shr 4])
            result.append(hexChars[i and 0x0F])
        }
        return result.toString()
    }
}
